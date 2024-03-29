/* tslint:disable */
/* eslint-disable */
/**
 * Ampli - A strong typed wrapper for your Analytics
 *
 * This file is generated by Amplitude.
 * To update run 'ampli pull scraper'
 *
 * Required dependencies: @amplitude/analytics-node@^0.5.0
 * Tracking Plan Version: 43
 * Build: 1.0.0
 * Runtime: node.js:typescript-ampli-v2
 *
 * [View Tracking Plan](https://data.amplitude.com/risklabs/Risk%20Labs/events/main/latest)
 *
 * [Full Setup Instructions](https://data.amplitude.com/risklabs/Risk%20Labs/implementation/scraper)
 */

import * as amplitude from "@amplitude/analytics-node";

export type NodeClient = amplitude.Types.NodeClient;
export type BaseEvent = amplitude.Types.BaseEvent;
export type Event = amplitude.Types.Event;
export type EventOptions = amplitude.Types.EventOptions;
export type Result = amplitude.Types.Result;
export type NodeOptions = amplitude.Types.NodeOptions;

export type Environment = "production" | "development" | "testing";

export const ApiKey: Record<Environment, string> = {
  production: "",
  development: "",
  testing: "",
};

/**
 * Default Amplitude configuration options. Contains tracking plan information.
 */
export const DefaultConfiguration: NodeOptions = {
  plan: {
    version: "43",
    branch: "main",
    source: "scraper",
    versionId: "364c665a-00b3-4f3a-86b4-72245b71f5a0",
  },
  ...{
    ingestionMetadata: {
      sourceName: "node.js-typescript-ampli",
      sourceVersion: "2.0.0",
    },
  },
};

export interface LoadOptionsBase {
  disabled?: boolean;
}

export type LoadOptionsWithEnvironment = LoadOptionsBase & {
  environment: Environment;
  client?: { configuration?: NodeOptions };
};
export type LoadOptionsWithApiKey = LoadOptionsBase & { client: { apiKey: string; configuration?: NodeOptions } };
export type LoadOptionsWithClientInstance = LoadOptionsBase & { client: { instance: NodeClient } };

export type LoadOptions = LoadOptionsWithEnvironment | LoadOptionsWithApiKey | LoadOptionsWithClientInstance;

export interface IdentifyProperties {
  /**
   * List of wallet addresses connected during Wallet Connect Transaction Completed event.
   *
   * | Rule | Value |
   * |---|---|
   * | Unique Items | true |
   * | Item Type | string |
   */
  allWalletAddressesConnected?: string[];
  /**
   * Chain ids of wallet addresses connected
   *
   * | Rule | Value |
   * |---|---|
   * | Unique Items | true |
   * | Item Type | string |
   */
  allWalletChainIds?: string[];
  initial_dclid?: any;
  initial_fbclid?: any;
  initial_gbraid?: any;
  initial_gclid?: any;
  initial_ko_click_id?: any;
  initial_msclkid?: any;
  initial_referrer?: any;
  initial_referring_domain?: any;
  initial_ttclid?: any;
  initial_twclid?: any;
  initial_utm_campaign?: any;
  initial_utm_content?: any;
  initial_utm_id?: any;
  initial_utm_medium?: any;
  initial_utm_source?: any;
  initial_utm_term?: any;
  initial_wbraid?: any;
  /**
   * Total volume of bridge transfers (since event tracking was implemented). Updated on each new transfer the user completes.
   *
   * | Rule | Value |
   * |---|---|
   * | Type | integer |
   */
  totalVolumeUsd: number;
  /**
   * Currently connected wallet address
   */
  walletAddress?: string;
  /**
   * Type of wallet connected
   */
  walletType?: string;
}

export interface TransferFillCompletedProperties {
  /**
   * Capital fee percent, in decimals
   */
  capitalFeePct: string;
  /**
   * Capital fee in the bridge token, in decimals
   */
  capitalFeeTotal: string;
  /**
   * Capital fee in USD
   */
  capitalFeeTotalUsd: string;
  depositCompleteTimestamp: string;
  fillAmount: string;
  fillAmountUsd: string;
  fillCompleteTimestamp: string;
  fillTimeInMs: string;
  /**
   * From amount in the bridge token, in decimals
   */
  fromAmount: string;
  /**
   * From amount in USD
   */
  fromAmountUsd: string;
  /**
   * Id of the fromChain
   */
  fromChainId: string;
  /**
   * From chain name
   */
  fromChainName: string;
  /**
   * Token address of bridge token on from chain
   */
  fromTokenAddress: string;
  isAmountTooLow: boolean;
  /**
   * Lp fee percent, in decimals
   */
  lpFeePct: string;
  /**
   * Lp fee in the bridge token, in decimals
   */
  lpFeeTotal: string;
  /**
   * Lp fee in USD
   */
  lpFeeTotalUsd: string;
  networkFeeNative: string;
  networkFeeNativeToken: string;
  networkFeeUsd: string;
  /**
   * Recipient wallet address
   */
  recipient: string;
  /**
   * Address of referee, null if no referral used
   */
  referralProgramAddress?: string;
  /**
   * Relay fee percent, in decimals
   */
  relayFeePct: string;
  /**
   * Relay fee in the gas token, in decimals
   */
  relayFeeTotal: string;
  /**
   * Relay fee in USD
   */
  relayFeeTotalUsd: string;
  /**
   * Relayer gas fee percent, in decimals
   */
  relayGasFeePct: string;
  /**
   * Relayer gas fee in the gas token, in decimals
   */
  relayGasFeeTotal: string;
  /**
   * Relayer fee in USD
   */
  relayGasFeeTotalUsd: string;
  /**
   * Route "{fromChainId}-{toChainId}"
   */
  routeChainIdFromTo: string;
  /**
   * Route "{fromChainName}-{toChainName}"
   */
  routeChainNameFromTo: string;
  /**
   * Sender wallet address
   */
  sender: string;
  /**
   * Result of user signing or rejecting wallet connection
   */
  succeeded: boolean;
  /**
   * To amount of bridge token, in decimals
   */
  toAmount: string;
  /**
   * To amount in USD
   */
  toAmountUsd: string;
  /**
   * Id of the toChain
   */
  toChainId: string;
  /**
   * Name of the toChain
   */
  toChainName: string;
  /**
   * Symbol of bridge token
   */
  tokenSymbol: string;
  /**
   * Total bridge fee in the bridge token, in decimals
   */
  totalBridgeFee: string;
  /**
   * Total bridge fee percent, in decimals
   */
  totalBridgeFeePct: string;
  /**
   * Total bridge fee in USD
   */
  totalBridgeFeeUsd: string;
  totalFilledAmount: string;
  totalFilledAmountUsd: string;
  /**
   * Token address of bridge token on to chain
   */
  toTokenAddress: string;
  /**
   * Resulting transaction hash of transaction, null if "result" if SwapSigned event = failed
   */
  transactionHash: string;
}

export class Identify implements BaseEvent {
  event_type = "Identify";

  constructor(public event_properties: IdentifyProperties) {
    this.event_properties = event_properties;
  }
}

export class TransferFillCompleted implements BaseEvent {
  event_type = "TransferFillCompleted";

  constructor(public event_properties: TransferFillCompletedProperties) {
    this.event_properties = event_properties;
  }
}

export type PromiseResult<T> = { promise: Promise<T | void> };

const getVoidPromiseResult = () => ({ promise: Promise.resolve() });

// prettier-ignore
export class Ampli {
  private disabled: boolean = false;
  private amplitude?: NodeClient;

  get client(): NodeClient {
    this.isInitializedAndEnabled();
    return this.amplitude!;
  }

  get isLoaded(): boolean {
    return this.amplitude != null;
  }

  private isInitializedAndEnabled(): boolean {
    if (!this.amplitude) {
      console.error('ERROR: Ampli is not yet initialized. Have you called ampli.load() on app start?');
      return false;
    }
    return !this.disabled;
  }

  /**
   * Initialize the Ampli SDK. Call once when your application starts.
   *
   * @param options Configuration options to initialize the Ampli SDK with.
   */
  load(options: LoadOptions): PromiseResult<void> {
    this.disabled = options.disabled ?? false;

    if (this.amplitude) {
      console.warn('WARNING: Ampli is already initialized. Ampli.load() should be called once at application startup.');
      return getVoidPromiseResult();
    }

    let apiKey: string | null = null;
    if (options.client && 'apiKey' in options.client) {
      apiKey = options.client.apiKey;
    } else if ('environment' in options) {
      apiKey = ApiKey[options.environment];
    }

    if (options.client && 'instance' in options.client) {
      this.amplitude = options.client.instance;
    } else if (apiKey) {
      this.amplitude = amplitude.createInstance();
      return this.amplitude.init(apiKey, { ...DefaultConfiguration, ...(options.client as any)?.configuration });
    } else {
      console.error("ERROR: ampli.load() requires 'environment', 'client.apiKey', or 'client.instance'");
    }

    return getVoidPromiseResult();
  }

  /**
   * Identify a user and set user properties.
   *
   * @param userId The user's id.
   * @param properties The user properties.
   * @param options Optional event options.
   */
  identify(
    userId: string | undefined,
    properties: IdentifyProperties,
    options?: EventOptions,
  ): PromiseResult<Result> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    if (userId) {
      options = {...options,  user_id: userId};
    }

    const amplitudeIdentify = new amplitude.Identify();
    const eventProperties = properties;
    if (eventProperties != null) {
      for (const [key, value] of Object.entries(eventProperties)) {
        amplitudeIdentify.set(key, value);
      }
    }

    return this.amplitude!.identify(amplitudeIdentify, options);
  }

  /**
   * Track event
   *
   * @param userId The user's id.
   * @param event The event to track.
   * @param options Optional event options.
   */
  track(userId: string | undefined, event: Event, options?: EventOptions): PromiseResult<Result> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    if (userId) {
      options = {...options,  user_id: userId};
    }

    return this.amplitude!.track(event, undefined, options);
  }

  flush(): PromiseResult<void> {
    if (!this.isInitializedAndEnabled()) {
      return getVoidPromiseResult();
    }

    return this.amplitude!.flush();
  }

  /**
   * TransferFillCompleted
   *
   * [View in Tracking Plan](https://data.amplitude.com/risklabs/Risk%20Labs/events/main/latest/TransferFillCompleted)
   *
   * Owner: Dong-Ha Kim
   *
   * @param userId The user's ID.
   * @param properties The event's properties (e.g. capitalFeePct)
   * @param options Amplitude event options.
   */
  transferFillCompleted(
    userId: string | undefined,
    properties: TransferFillCompletedProperties,
    options?: EventOptions,
  ) {
    return this.track(userId, new TransferFillCompleted(properties), options);
  }
}

export const ampli = new Ampli();
