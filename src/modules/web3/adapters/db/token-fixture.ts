import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Token } from "../../model/token.entity";

@Injectable()
export class TokenFixture {
  public constructor(@InjectRepository(Token) private tokenRepository: Repository<Token>) {}

  public insertToken(depositArgs: Partial<Token>) {
    const Token = this.tokenRepository.create(this.mockTokenEntity(depositArgs));
    return this.tokenRepository.save(Token);
  }

  public insertManyTokens(args: Partial<Token>[]) {
    const createdDeposits = this.tokenRepository.create(args);
    return this.tokenRepository.save(createdDeposits);
  }

  public deleteAllTokens() {
    return this.tokenRepository.query(`truncate table "token" restart identity cascade`);
  }

  public mockTokenEntity(overrides: Partial<Token>): Partial<Token> {
    return {
      name: "Token",
      symbol: "TOK",
      address: "0x",
      chainId: 1,
      decimals: 18,
      ...overrides,
    };
  }
}
