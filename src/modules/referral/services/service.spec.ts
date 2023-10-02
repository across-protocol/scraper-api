import { Test } from "@nestjs/testing";
import { ReferralService } from "./service";

describe("ReferralService", () => {
  let service: ReferralService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReferralService],
    })
      .useMocker(() => {
        return {};
      })
      .compile();

    service = moduleRef.get(ReferralService);
  });

  it("should extract referral address", () => {
    const address = service.extractReferralAddressWithoutDelimiter(
      "0x492289780000000000000000000000009a8f92a830a5cb89a3816e3d267cb7791c16b04d000000000000000000000000d693ec944a85eeca4247ec1c3b130dca9b0c3b220000000000000000000000000000000000000000000000001bc16d674ec800000000000000000000000000000000000000000000000000000000000000000089000000000000000000000000000000000000000000000000000296fa282474290000000000000000000000000000000000000000000000000000000062c42cf09a8f92a830a5cb89a3816e3d267cb7791c16b04d",
    );
    expect(address).toEqual("0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D");
  });

  it("shouldn't extract referral address if length is invalid", () => {
    const address = service.extractReferralAddressWithoutDelimiter(
      "0x49228978000000000000000000000000267662aeb1cb1afcc958012d866a8af243518684000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000013fbe85edc90000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000a20a6efcd741b000000000000000000000000000000000000000000000000000000006295da2d",
    );
    expect(address).toEqual(undefined);
  });

  it("should extract referral address if delimiter is used", () => {
    const address = service.extractReferralAddressUsingDelimiter(
      "0x492289780000000000000000000000009a8f92a830a5cb89a3816e3d267cb7791c16b04d000000000000000000000000d693ec944a85eeca4247ec1c3b130dca9b0c3b220000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000890000000000000000000000000000000000000000000000000004119f446d1d2f0000000000000000000000000000000000000000000000000000000062c836e5d00dfeeddeadbeef9a8f92a830a5cb89a3816e3d267cb7791c16b04d",
    );
    expect(address).toEqual("0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D");
  });

  it("should extract referral address if delimiter is not found", () => {
    const address = service.extractReferralAddressUsingDelimiter(
      "0x492289780000000000000000000000009a8f92a830a5cb89a3816e3d267cb7791c16b04d000000000000000000000000d693ec944a85eeca4247ec1c3b130dca9b0c3b220000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000890000000000000000000000000000000000000000000000000004119f446d1d2f0000000000000000000000000000000000000000000000000000000062c836e59a8f92a830a5cb89a3816e3d267cb7791c16b04d",
    );
    expect(address).toEqual(undefined);
  });

  it("should not extract referral address if calldata too short", () => {
    const address = service.extractReferralAddressUsingDelimiter(
      "0xb1a8f7c700000000000000000000000000000000000000000000000000000000000000ca00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000022000100000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000000000000000000000000000000000000000",
    );
    expect(address).toEqual(undefined);
  });
});
