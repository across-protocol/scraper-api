import { ERC20__factory, AcrossMerkleDistributor__factory } from "@across-protocol/contracts-v2";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ethers } from "ethers";
import { AppConfig } from "../../configuration/configuration.service";
import { Repository } from "typeorm";
import { Block } from "../model/block.entity";
import { ChainId } from "../model/ChainId";
import { Token } from "../model/token.entity";
import { SpokePoolEventsQuerier } from "./SpokePoolEventsQuerier";
import { MerkleDistributorEventsQuerier } from "./MerkleDistributorEventsQuerier";
import { Transaction } from "../model/transaction.entity";
import { TransactionReceipt } from "../model/tx-receipt.entity";

@Injectable()
export class EthProvidersService {
  private providers: Record<string, ethers.providers.JsonRpcProvider> = {};
  private spokePoolEventQueriers: Record<string, Record<string, SpokePoolEventsQuerier>> = {};
  private merkleDistributorEventQueriers: Record<string, Record<string, MerkleDistributorEventsQuerier>> = {};

  public constructor(
    private appConfig: AppConfig,
    @InjectRepository(Block) private blockRepository: Repository<Block>,
    @InjectRepository(Token) private tokenRepository: Repository<Token>,
    @InjectRepository(Transaction) private transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionReceipt) private txReceiptRepository: Repository<TransactionReceipt>,
  ) {
    this.setProviders();
    this.setSpokePoolEventQueriers();
    this.setMerkleDistributorEventQueriers();
  }

  public getProvider(chainId: ChainId): ethers.providers.JsonRpcProvider | undefined {
    return this.providers[chainId];
  }

  public getProviders() {
    return this.providers;
  }

  public getSpokePoolEventQuerier(chainId: ChainId, address: string): SpokePoolEventsQuerier | undefined {
    return this.spokePoolEventQueriers[chainId][address];
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
      const tokenContract = ERC20__factory.connect(tokenAddr, this.getProvider(chainId));
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
      } = receipt;
      cachedReceipt = this.txReceiptRepository.create({
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
      });
      cachedReceipt = await this.txReceiptRepository.save(cachedReceipt);
    }

    return cachedReceipt;
  }

  private setProviders() {
    const supportedChainIds = Object.keys(this.appConfig.values.web3.providers);

    for (const chainId of supportedChainIds) {
      if (this.appConfig.values.web3.providers[chainId]) {
        const provider = new ethers.providers.JsonRpcProvider(this.appConfig.values.web3.providers[chainId]);
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
        this.spokePoolEventQueriers[chainId][spokePool.address] = new SpokePoolEventsQuerier(contract);
      }
    }
  }

  private setMerkleDistributorEventQueriers() {
    let chainId = this.appConfig.values.web3.merkleDistributor.chainId;
    let provider = this.getProvider(chainId);
    let address = this.appConfig.values.web3.merkleDistributor.address;
    let contract = AcrossMerkleDistributor__factory.connect(address, provider);
    this.merkleDistributorEventQueriers[chainId] = {
      [address]: new MerkleDistributorEventsQuerier(contract),
    };

    chainId = this.appConfig.values.web3.merkleDistributorContracts.opRewards.chainId;
    provider = this.getProvider(chainId);
    address = this.appConfig.values.web3.merkleDistributorContracts.opRewards.address;

    if (address) {
      contract = AcrossMerkleDistributor__factory.connect(address, provider);
      this.merkleDistributorEventQueriers[chainId] = {
        ...(this.merkleDistributorEventQueriers[chainId] || {}),
        [address]: new MerkleDistributorEventsQuerier(contract),
      };
    }
  }
}
