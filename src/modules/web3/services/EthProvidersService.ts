import { AcrossMerkleDistributor } from "@across-protocol/contracts-v2";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ethers } from "ethers";
import { DataSource, Repository } from "typeorm";

import { AppConfig } from "../../configuration/configuration.service";
import { Block } from "../model/block.entity";
import { ChainId, ChainIds } from "../model/ChainId";
import { Token } from "../model/token.entity";
import { Transaction } from "../model/transaction.entity";
import { TransactionReceipt } from "../model/tx-receipt.entity";
import { AcrossContractsVersion } from "../model/across-version";
import { SpokePoolEventsQuerier } from "./SpokePoolEventsQuerier";
import { MerkleDistributorEventsQuerier } from "./MerkleDistributorEventsQuerier";
import ERC20Abi from "../../web3/services/abi/ERC20.json";
import AcrossMerkleDistributorAbi from "../../web3/services/abi/AcrossMerkleDistributor.json";
import { HubPoolEventsQuerier } from "./HubPoolEventsQuerier";

@Injectable()
export class EthProvidersService {
  private providers: Record<string, ethers.providers.JsonRpcProvider> = {};
  private spokePoolEventQueriers: Record<string, Record<string, SpokePoolEventsQuerier>> = {};
  private hubPoolEventQueriers: Record<string, Record<string, HubPoolEventsQuerier>> = {};
  private merkleDistributorEventQueriers: Record<string, Record<string, MerkleDistributorEventsQuerier>> = {};

  public constructor(
    private appConfig: AppConfig,
    @InjectRepository(Block) private blockRepository: Repository<Block>,
    @InjectRepository(Token) private tokenRepository: Repository<Token>,
    @InjectRepository(Transaction) private transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionReceipt) private txReceiptRepository: Repository<TransactionReceipt>,
    private dataSource: DataSource,
  ) {
    this.setProviders();
    this.setSpokePoolEventQueriers();
    this.setMerkleDistributorEventQueriers();
    this.setHubPoolEventQueriers();
  }

  public getProvider(chainId: ChainId): ethers.providers.JsonRpcProvider | undefined {
    return this.providers[chainId];
  }

  public getProviders() {
    return this.providers;
  }

  public getSpokePoolEventQuerier(
    chainId: ChainId,
    version: AcrossContractsVersion,
  ): SpokePoolEventsQuerier | undefined {
    return this.spokePoolEventQueriers[chainId][version];
  }

  public getHubPoolEventQuerier(chainId: ChainId, address: string): HubPoolEventsQuerier | undefined {
    return this.hubPoolEventQueriers[chainId][address];
  }

  public getSpokePoolEventQueriers() {
    return this.spokePoolEventQueriers;
  }

  public getMerkleDistributorQueriers() {
    return this.merkleDistributorEventQueriers;
  }

  public getMerkleDistributorQuerier(chainId: ChainId, address: string) {
    return this.merkleDistributorEventQueriers[chainId][address];
  }

  public async getCachedBlock(chainId: number, blockNumber: number) {
    let block = await this.blockRepository.findOne({ where: { chainId, blockNumber } });

    if (!block) {
      const web3Block = await this.getProvider(chainId).getBlock(blockNumber);
      block = this.blockRepository.create({
        chainId,
        blockNumber,
        date: new Date(web3Block.timestamp * 1000).toISOString(),
      });
      block = await this.blockRepository.save(block);
    }

    return block;
  }

  public async getCachedToken(chainId: number, tokenAddr: string) {
    let token = await this.tokenRepository.findOne({ where: { chainId, address: tokenAddr } });

    if (!token) {
      const tokenContract = new ethers.Contract(tokenAddr, JSON.stringify(ERC20Abi), this.getProvider(chainId));
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);
      token = this.tokenRepository.create({
        address: tokenAddr,
        chainId,
        name,
        symbol,
        decimals,
      });
      token = await this.tokenRepository.save(token);
    }

    return token;
  }

  public async getCachedTransaction(chainId: number, hash: string) {
    let transaction = await this.transactionRepository.findOne({ where: { chainId, hash } });

    if (!transaction) {
      const web3Transaction = await this.getProvider(chainId).getTransaction(hash);
      const { data, blockNumber } = web3Transaction;
      transaction = this.transactionRepository.create({
        chainId,
        data,
        hash,
        blockNumber,
      });
      transaction = await this.transactionRepository.save(transaction);
    }

    return transaction;
  }

  public async getCachedTransactionReceipt(chainId: number, hash: string) {
    let cachedReceipt = await this.txReceiptRepository.findOne({ where: { chainId, hash } });

    if (cachedReceipt && !cachedReceipt.logs) {
      await this.txReceiptRepository.delete({ chainId, hash });
      cachedReceipt = undefined;
    }

    if (!cachedReceipt) {
      const receipt = await this.getProvider(chainId).getTransactionReceipt(hash);
      const {
        from,
        to,
        transactionHash,
        blockNumber,
        transactionIndex,
        contractAddress,
        gasUsed,
        effectiveGasPrice,
        blockHash,
        logs,
      } = receipt;
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(TransactionReceipt)
        .values({
          from,
          to,
          hash: transactionHash,
          transactionIndex,
          contractAddress,
          gasUsed: gasUsed.toString(),
          effectiveGasPrice: effectiveGasPrice.toString(),
          chainId,
          blockHash,
          blockNumber,
          logs: logs as any[],
        })
        .orIgnore()
        .execute();
      cachedReceipt = await this.txReceiptRepository.findOne({ where: { chainId, hash } });
    }

    return cachedReceipt;
  }

  public parseTransactionReceiptLogs(receipt: TransactionReceipt, eventName: string, abi: any) {
    const events: ethers.utils.LogDescription[] = [];

    for (const log of receipt.logs) {
      const contractInterface = new ethers.utils.Interface(abi);

      if (log.topics.length === 0) continue;

      try {
        const parsedLog = contractInterface.parseLog(log);
        if (parsedLog && parsedLog.name === eventName) {
          events.push({ ...log, ...parsedLog });
        }
      } catch (e) {
        if (e.reason === "no matching event" && e.code === "INVALID_ARGUMENT") {
          continue;
        } else {
          throw e;
        }
      }
    }

    return events;
  }

  private setProviders() {
    const supportedChainIds = Object.keys(this.appConfig.values.web3.providers);

    for (const chainId of supportedChainIds) {
      if (this.appConfig.values.web3.providers[chainId]) {
        let provider: ethers.providers.JsonRpcProvider;
        if (chainId === ChainIds.lens.toString()) {
          // Note: we need to include headers for Lens provider
          provider = new ethers.providers.StaticJsonRpcProvider(
            {
              url: this.appConfig.values.web3.providers[chainId],
              headers: {
                auth: this.appConfig.values.web3.lensAuthHeader,
              },
            },
            Number(chainId),
          );
        } else {
          provider = new ethers.providers.StaticJsonRpcProvider(
            this.appConfig.values.web3.providers[chainId],
            Number(chainId),
          );
        }
        this.providers[chainId] = provider;
      }
    }
  }

  private setSpokePoolEventQueriers() {
    const chains = this.appConfig.values.spokePoolsEventsProcessingChainIds;
    for (const chainId of chains) {
      this.spokePoolEventQueriers[chainId] = {};
      const spokePools = this.appConfig.values.web3.spokePoolContracts[chainId] || [];
      for (const spokePool of spokePools) {
        const contract = new ethers.Contract(spokePool.address, spokePool.abi, this.getProvider(chainId));
        this.spokePoolEventQueriers[chainId][spokePool.acrossVersion] = new SpokePoolEventsQuerier(contract);
      }
    }
  }

  private setMerkleDistributorEventQueriers() {
    const chainId = this.appConfig.values.web3.merkleDistributor.chainId;
    let provider = this.getProvider(chainId);
    const address = this.appConfig.values.web3.merkleDistributor.address;
    let contract = new ethers.Contract(address, JSON.stringify(AcrossMerkleDistributorAbi), provider);
    this.merkleDistributorEventQueriers[chainId] = {
      [address]: new MerkleDistributorEventsQuerier(contract as AcrossMerkleDistributor),
    };

    for (const contractConfig of Object.values(this.appConfig.values.web3.merkleDistributorContracts)) {
      provider = this.getProvider(contractConfig.chainId);
      contract = new ethers.Contract(contractConfig.address, JSON.stringify(AcrossMerkleDistributorAbi), provider);
      this.merkleDistributorEventQueriers[contractConfig.chainId] = {
        ...(this.merkleDistributorEventQueriers[contractConfig.chainId] || {}),
        [contractConfig.address]: new MerkleDistributorEventsQuerier(contract as AcrossMerkleDistributor),
      };
    }
  }

  private setHubPoolEventQueriers() {
    const chains = Object.keys(this.appConfig.values.web3.hubPoolContracts).map(chainId => Number(chainId));
    for (const chainId of chains) {
      const hubPool = this.appConfig.values.web3.hubPoolContracts[chainId];
      const contract = new ethers.Contract(hubPool.address, hubPool.abi, this.getProvider(chainId));
      this.hubPoolEventQueriers[chainId] = {
        ...(this.hubPoolEventQueriers[chainId] || {}),
        [hubPool.address]: new HubPoolEventsQuerier(contract),
      };
    }
  }
}
