
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocketService } from 'src/common/websocket/socket.service';
import * as TradingViewModule from '@mathieuc/tradingview';
const { Client, getIndicator } = TradingViewModule;
import * as TradingView from '@mathieuc/tradingview';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface IndicatorSettings {
  indicator: 'EMA50' | 'EMA200' | 'RSI' | 'MACD' | 'FibonacciBollingerBands' | 'VWAP' | 'BollingerBands' | 'CandlestickPatterns' | 'Nadaraya-Watson-LuxAlgo' | 'SRv2' | 'Pivot Points High Low' | 'Pivot Points Standard';
  period?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4';
  offset?: number;
  latestValue?: number;
  length?: number;
  bbStdDev?: number;
  rsiLength?: number;
  maType?: 'None' | 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  macdSourceMaType?: 'SMA' | 'EMA';
  macdSignalMaType?: 'SMA' | 'EMA';
  fibLookback?: number;
  multiply?: number;
  vwapAnchor?: 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';
  vwapBandsMultiplier1?: number;
  vwapBandsMultiplier2?: number;
  vwapBandsMultiplier3?: number;
  hideVwapOn1DOrAbove?: boolean;
  bandsCalculationMode?: 'Standard Deviation' | 'Percentage';
  band1?: boolean;
  band2?: boolean;
  band3?: boolean;
  timeframeInput?: string;
  waitForTimeframeCloses?: boolean;
  calculateDivergence?: boolean;
  patternType?: 'Bullish' | 'Bearish' | 'Both';
  trendRule?: 'SMA50' | 'SMA50, SMA200' | 'No detection';
  patternSettings?: {
    Abandoned_Baby?: boolean;
    Dark_Cloud_Cover?: boolean;
    Doji?: boolean;
    Doji_Star?: boolean;
    Downside_Tasuki_Gap?: boolean;
    Dragonfly_Doji?: boolean;
    Engulfing?: boolean;
    Evening_Doji_Star?: boolean;
    Evening_Star?: boolean;
    Falling_Three_Methods?: boolean;
    Falling_Window?: boolean;
    Gravestone_Doji?: boolean;
    Hammer?: boolean;
    Hanging_Man?: boolean;
    Harami_Cross?: boolean;
    Harami?: boolean;
    Inverted_Hammer?: boolean;
    Kicking?: boolean;
    Long_Lower_Shadow?: boolean;
    Long_Upper_Shadow?: boolean;
    Marubozu_Black?: boolean;
    Marubozu_White?: boolean;
    Morning_Doji_Star?: boolean;
    Morning_Star?: boolean;
    On_Neck?: boolean;
    Piercing?: boolean;
    Rising_Three_Methods?: boolean;
    Rising_Window?: boolean;
    Shooting_Star?: boolean;
    Spinning_Top_Black?: boolean;
    Spinning_Top_White?: boolean;
    Three_Black_Crows?: boolean;
    Three_White_Soldiers?: boolean;
    TriStar?: boolean;
    Tweezer_Bottom?: boolean;
    Tweezer_Top?: boolean;
    Upside_Tasuki_Gap?: boolean;
  };
  Bandwidth?: number;
  mult?: number;
  Source?: 'close' | 'High/Low' | 'Close/Open';
  Repainting_Smoothing?: boolean;
  Pivot_Period?: number;
  Maximum_Number_of_Pivot?: number;
  Maximum_Channel_Width_?: number;
  Maximum_Number_of_SR?: number;
  Minimum_Strength?: number;
  Label_Location?: number;
  Line_Style?: 'Solid' | 'Dashed' | 'Dotted';
  Line_Width?: number;
  Show_Point_Points?: boolean;
  Pivot_High?: number;
  Pivot_Low?: number;
  Type?: 'Traditional' | 'Fibonacci' | 'Woodie' | 'Classic' | 'DM' | 'Camarilla';
  Pivots_Timeframe?: 'Auto' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Biyearly' | 'Triyearly' | 'Quinquennially' | 'Decennially';
  Number_of_Pivots_Back?: number;
  Use_Dailybased_Values?: boolean;
}

@Injectable()
export class IndicatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndicatorService.name);
  private indicatorSettings: { [key: string]: IndicatorSettings } = {};
  private emissionSettings: { [key: string]: { enabledIndicators: string[]; enabledTimeframes: string[] } } = {};
  private indicatorList: string[] = [
    'EMA50', 
    'EMA200', 
    'RSI', 
    'MACD',
    'FibonacciBollingerBands', 
    'VWAP', 
    'BollingerBands', 
    'CandlestickPatterns',
    'Nadaraya-Watson-LuxAlgo',
    'SRv2',
    'Pivot Points High Low',
    'Pivot Points Standard',
  ];
  private symbols: string[] = [
    'VANTAGE:XAUUSD',
    'VANTAGE:GER40',
    'VANTAGE:NAS100',
    'BINANCE:BTCUSDT'
  ];
  private timeframes: string[] = [
    '15',
    '60',
    '240',
    '1D',
    '1W'
  ];
  private readonly tvCredentials: { [symbol: string]: { session: string; signature: string } } = {
    'VANTAGE:XAUUSD': { session: 'ah812nch1fjn50wh93nacny1nk286eyc', signature: 'v3:BVWFN51Qcwln48iw3Uz0WbWkxmiX2SbmbheoFmCruiE=' },
    'VANTAGE:GER40': { session: 's1ycepfkikx69v3dvifi1hzld2gxu4bn', signature: 'v3:uOHIyCVOqUJFYtZ6LoV+j20uGJEE0eOuJoYSZ0eMU6k=' },
    'VANTAGE:NAS100': { session: '1kw9xc2ckwvfjm46n022jjwj82wvkai0', signature: 'v3:NZqDSi4EqlcEM3AaK0McWdhtpeYRVhEM+m+XJgL30/M=' },
    'BINANCE:BTCUSDT': { session: 'c7bpt5jh7ohx5yrbjt8c5mxxfpjd3rnx', signature: 'v3:AMeke7FM58qjON6a6gIbhCZu5t1oSCPYyJ3XplXfaZk=' }
  };
  private readonly defaultSettings: IndicatorSettings[] = [
    { indicator: 'EMA50', period: 50, source: 'close', offset: 0, maType: 'EMA' },
    { indicator: 'EMA200', period: 200, source: 'close', offset: 0, maType: 'EMA' },
    { 
      indicator: 'RSI', 
      rsiLength: 14, 
      length: 14, 
      maType: 'SMA', 
      bbStdDev: 2, 
      source: 'close', 
      offset: 0,
      calculateDivergence: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'MACD', 
      macdFastPeriod: 12, 
      macdSlowPeriod: 26, 
      macdSignalPeriod: 9, 
      macdSourceMaType: 'EMA', 
      macdSignalMaType: 'EMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'FibonacciBollingerBands', 
      fibLookback: 200, 
      multiply: 3,
      source: 'hlc3' 
    },
    { 
      indicator: 'VWAP', 
      vwapAnchor: 'Session', 
      vwapBandsMultiplier1: 1, 
      vwapBandsMultiplier2: 2, 
      vwapBandsMultiplier3: 3, 
      source: 'hlc3',
      hideVwapOn1DOrAbove: false,
      bandsCalculationMode: 'Standard Deviation',
      offset: 0,
      band1: true,
      band2: false,
      band3: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'BollingerBands', 
      length: 20, 
      bbStdDev: 2, 
      maType: 'SMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'CandlestickPatterns', 
      patternType: 'Both', 
      trendRule: 'SMA50', 
      patternSettings: {
        Abandoned_Baby: true,
        Dark_Cloud_Cover: true,
        Doji: true,
        Doji_Star: true,
        Downside_Tasuki_Gap: true,
        Dragonfly_Doji: true,
        Engulfing: true,
        Evening_Doji_Star: true,
        Evening_Star: true,
        Falling_Three_Methods: true,
        Falling_Window: true,
        Gravestone_Doji: true,
        Hammer: true,
        Hanging_Man: true,
        Harami_Cross: true,
        Harami: true,
        Inverted_Hammer: true,
        Kicking: true,
        Long_Lower_Shadow: true,
        Long_Upper_Shadow: true,
        Marubozu_Black: true,
        Marubozu_White: true,
        Morning_Doji_Star: true,
        Morning_Star: true,
        On_Neck: true,
        Piercing: true,
        Rising_Three_Methods: true,
        Rising_Window: true,
        Shooting_Star: true,
        Spinning_Top_Black: true,
        Spinning_Top_White: true,
        Three_Black_Crows: true,
        Three_White_Soldiers: true,
        TriStar: true,
        Tweezer_Bottom: true,
        Tweezer_Top: true,
        Upside_Tasuki_Gap: true
      },
    },
    {
      indicator: 'Nadaraya-Watson-LuxAlgo',
      Bandwidth: 8,
      mult: 3,
      Source: 'close',
      Repainting_Smoothing: true,
    },
    {
      indicator: 'SRv2',
      Pivot_Period: 10,
      Source: 'High/Low',
      Maximum_Number_of_Pivot: 20,
      Maximum_Channel_Width_: 10,
      Maximum_Number_of_SR: 5,
      Minimum_Strength: 2,
      Label_Location: 20,
      Line_Style: 'Dashed',
      Line_Width: 2,
      Show_Point_Points: false,
    },
    {
      indicator: 'Pivot Points High Low',
      Pivot_High: 10,
      Pivot_Low: 10,
    },
    {
      indicator: 'Pivot Points Standard',
      Type: 'Traditional',
      Pivots_Timeframe: 'Auto',
      Number_of_Pivots_Back: 15,
      Use_Dailybased_Values: true,
    },
  ];
  private tvClients: { [symbol: string]: any } = {};
  private charts: { [key: string]: any } = {};
  private proxyList: string[] = [
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10004',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  ];
  private proxyAssignments: { [symbol: string]: string } = {
    'VANTAGE:XAUUSD': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'VANTAGE:GER40': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'VANTAGE:NAS100': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'BINANCE:BTCUSDT': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  };
  private marketPriceProxy: string = 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10005';
  structuredData: any = {};
  lastUpdateTime: number;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelayBase = 5000; // Base delay in ms
  private readonly proxyRetryInterval = 10000; // Time to wait before retrying a new proxy
  private chartTimeouts: { [key: string]: NodeJS.Timeout } = {}; // Track timeouts for all charts
  private reconnectAttempts: { [symbol: string]: number } = {};

  constructor(
    private readonly httpService: HttpService,
    @Inject('SOCKET_SERVICE') private socketService: SocketService,
    @InjectModel('IndicatorSettings') private indicatorSettingsModel: Model<any>,
    @InjectModel('EmissionSettings') private emissionSettingsModel: Model<any>,
  ) {}

  private getProxyForSymbol(symbol: string): string {
    const assignedProxy = this.proxyAssignments[symbol];
    if (assignedProxy && this.isProxyAlive(assignedProxy)) {
      return assignedProxy;
    }
    // Fallback to a random proxy from the list
    const availableProxies = this.proxyList.filter(proxy => proxy !== assignedProxy && this.isProxyAlive(proxy));
    const fallbackProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)] || this.proxyList[0];
    this.logger.warn(`[${new Date().toISOString()}] Proxy for ${symbol} failed, falling back to ${fallbackProxy}`);
    this.proxyAssignments[symbol] = fallbackProxy; // Update assignment
    return fallbackProxy;
  }

  private isProxyAlive(proxyUrl: string): boolean {
    // Placeholder: In a real implementation, you could ping the proxy or track recent failures
    return true;
  }

  async onModuleInit() {
    try {
      this.logger.log(`[${new Date().toISOString()}] Server starting`);
      await this.initializeVantageData();
      await this.initializeTradingView();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Server startup failed: ${error.message}`);
      throw error;
    }
  }

  private async initializeTradingView() {
    try {
      for (const symbol of this.symbols) {
        const creds = this.tvCredentials[symbol];
        if (!creds || !creds.session || !creds.signature) {
          this.logger.error(`Missing TradingView session or signature for ${symbol}`);
          throw new Error(`Missing TradingView session or signature for ${symbol}`);
        }
        const proxyUrl = this.getProxyForSymbol(symbol);
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        this.tvClients[symbol] = new Client({
          token: creds.session,
          signature: creds.signature,
          fetchOptions: {
            agent: proxyAgent,
          },
        });
        
        this.tvClients[symbol].onError((err: Error) => {
          try {
            this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
            this.reinitializeClient(symbol);
          } catch (error) {
            this.logger.error(`Failed during error handling for ${symbol}: ${error.message}`, error.stack);
          }
        });
        this.logger.verbose(`TradingView WS connected for ${symbol} using proxy ${proxyUrl}`);
      }
      await this.setupIndicatorsAndPrice();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] TradingView initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async reinitializeClient(symbol: string, attempt: number = 1) {
    try {
      if (this.reconnectAttempts[symbol] >= this.maxReconnectAttempts) {
        this.logger.error(`[${new Date().toISOString()}] Max reconnect attempts reached for ${symbol}`);
        return;
      }

      this.reconnectAttempts[symbol] = (this.reconnectAttempts[symbol] || 0) + 1;
      if (this.tvClients[symbol]) {
        await this.tvClients[symbol].end();
        this.tvClients[symbol] = null;
      }
      const creds = this.tvCredentials[symbol];
      const proxyUrl = this.getProxyForSymbol(symbol);
      const proxyAgent = new HttpsProxyAgent(proxyUrl);
      this.tvClients[symbol] = new Client({
        token: creds.session,
        signature: creds.signature,
        fetchOptions: {
          agent: proxyAgent,
        },
      });
      this.tvClients[symbol].onError((err: Error) => {
        this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
        setTimeout(() => this.reinitializeClient(symbol, attempt + 1), this.reconnectDelayBase * Math.pow(2, attempt));
      });
      this.logger.verbose(`TradingView WS reconnected for ${symbol} using proxy ${proxyUrl} (attempt ${attempt})`);
      this.reconnectAttempts[symbol] = 0;
      await this.setupIndicatorsAndPrice(symbol);
    } catch (error) {
      this.logger.error(`Failed to reinitialize client for ${symbol} (attempt ${attempt}): ${error.message}`);
      setTimeout(() => this.reinitializeClient(symbol, attempt + 1), this.reconnectDelayBase * Math.pow(2, attempt));
    }
  }

  private async initializeVantageData() {
    try {
      const emissionSettings = await this.emissionSettingsModel.find().exec();
      emissionSettings.forEach(settings => {
        this.emissionSettings[settings.symbol] = {
          enabledIndicators: settings.enabledIndicators,
          enabledTimeframes: settings.enabledTimeframes,
        };
      });
      await this.loadIndicatorSettings();
      await this.loadEmissionSettings();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async loadIndicatorSettings() {
    try {
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          for (const defaultSetting of this.defaultSettings) {
            const key = `${symbol}:${timeframe}:${defaultSetting.indicator}`;
            const existingSettings = await this.indicatorSettingsModel
              .findOne({ symbol, timeframe, indicator: defaultSetting.indicator })
              .exec();
            if (existingSettings) {
              this.indicatorSettings[key] = { ...existingSettings.toObject() };
              loadedSettingsCount++;
            } else {
              const newSettings = { symbol, timeframe, symbolTimeframeIndicator: key, ...defaultSetting };
              await this.indicatorSettingsModel
                .findOneAndUpdate(
                  { symbol, timeframe, indicator: defaultSetting.indicator },
                  newSettings,
                  { upsert: true, new: true }
                )
                .exec();
              this.indicatorSettings[key] = { ...defaultSetting };
              this.logger.log(`[${new Date().toISOString()}] Initialized default indicator settings for ${key}`);
            }
          }
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} indicator settings from MongoDB`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load indicator settings: ${error.message}`);
      throw error;
    }
  }

  private async loadEmissionSettings() {
    try {
      const defaultEmissionSettings = {
        enabledIndicators: this.indicatorList,
        enabledTimeframes: this.timeframes,
      };
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        const existingSettings = await this.emissionSettingsModel
          .findOne({ symbol })
          .exec();
        if (existingSettings) {
          this.emissionSettings[symbol] = {
            enabledIndicators: existingSettings.enabledIndicators,
            enabledTimeframes: existingSettings.enabledTimeframes,
          };
          loadedSettingsCount++;
        } else {
          const newSettings = { symbol, ...defaultEmissionSettings };
          await this.emissionSettingsModel
            .findOneAndUpdate({ symbol }, newSettings, { upsert: true, new: true })
            .exec();
          this.emissionSettings[symbol] = { ...defaultEmissionSettings };
          this.logger.log(`[${new Date().toISOString()}] Initialized default emission settings for ${symbol}`);
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} emission settings from MongoDB, initialized ${this.symbols.length - loadedSettingsCount} with defaults`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load emission settings: ${error.message}`);
      throw error;
    }
  }

  async saveIndicatorSettings(settings: IndicatorSettings & { symbol: string; timeframe: string; indicator: string }) {
    try {
      const key = `${settings.symbol}:${settings.timeframe}:${settings.indicator}`;
      await this.indicatorSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol, timeframe: settings.timeframe, indicator: settings.indicator },
          { ...settings, symbolTimeframeIndicator: key },
          { upsert: true, new: true }
        )
        .exec();
      this.indicatorSettings[key] = { ...settings };
      this.logger.log(`[${new Date().toISOString()}] Saved indicator settings for ${key}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Settings saved' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save indicator settings for ${settings.symbol}:${settings.timeframe}:${settings.indicator}: ${error.message}`);
      throw error;
    }
  }

  async saveEmissionSettings(settings: { symbol: string; enabledIndicators: string[]; enabledTimeframes: string[] }) {
    try {
      await this.emissionSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol },
          settings,
          { upsert: true, new: true }
        )
        .exec();
      this.emissionSettings[settings.symbol] = {
        enabledIndicators: settings.enabledIndicators,
        enabledTimeframes: settings.enabledTimeframes,
      };
      this.logger.log(`[${new Date().toISOString()}] Saved emission settings for ${settings.symbol}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Emission settings updated successfully' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save emission settings for ${settings.symbol}: ${error.message}`);
      throw error;
    }
  }

  async getIndicatorSettings(symbol: string, timeframe: string) {
    try {
      const settings = await this.indicatorSettingsModel
        .find({ symbol, timeframe })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched indicator settings for ${symbol}:${timeframe}:`, JSON.stringify(settings, null, 2));
      return settings.length > 0 ? settings : null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch indicator settings for ${symbol}:${timeframe}: ${error.message}`);
      throw error;
    }
  }

  async getEmissionSettings(symbol: string) {
    try {
      const settings = await this.emissionSettingsModel
        .findOne({ symbol })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched emission settings for ${symbol}:`, JSON.stringify(settings, null, 2));
      return settings || null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch emission settings for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  private async setupIndicatorsAndPrice(symbol?: string) {
    const symbolsToSetup = symbol ? [symbol] : this.symbols;
    const indicatorsMap: Record<string, any> = {};
    const tvIndicators = [
      {
        name: 'EMA50',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.period ?? 50,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.maType ?? 'EMA'
        })
      },
      {
        name: 'EMA200',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.period ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.maType ?? 'EMA'
        })
      },
      {
        name: 'RSI',
        id: 'STD;RSI',
        inputs: (settings: IndicatorSettings) => ({
          RSI_Length: settings?.rsiLength ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.rsiLength ?? 14,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.source ?? 'close',
          Calculate_Divergence: settings?.calculateDivergence ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.calculateDivergence ?? false,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.maType ?? 'SMA',
          Length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.length ?? 14,
          BB_StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.bbStdDev ?? 2,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'MACD',
        id: 'STD;MACD',
        inputs: (settings: IndicatorSettings) => ({
          Fast_Length: settings?.macdFastPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdFastPeriod ?? 12,
          Slow_Length: settings?.macdSlowPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSlowPeriod ?? 26,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.source ?? 'close',
          Signal_Smoothing: settings?.macdSignalPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalPeriod ?? 9,
          Oscillator_MA_Type: settings?.macdSourceMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSourceMaType ?? 'EMA',
          Signal_Line_MA_Type: settings?.macdSignalMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalMaType ?? 'EMA',
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'FibonacciBollingerBands',
        id: 'PUB;2835',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.fibLookback ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.fibLookback ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.source ?? 'hlc3',
          mult: settings?.multiply ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.multiply ?? 3
        })
      },
      {
        name: 'VWAP',
        id: 'STD;VWAP',
        inputs: (settings: IndicatorSettings) => ({
          Hide_VWAP_on_1D_or_Above: settings?.hideVwapOn1DOrAbove ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.hideVwapOn1DOrAbove ?? false,
          Anchor_Period: settings?.vwapAnchor ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapAnchor ?? 'Session',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.source ?? 'hlc3',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.offset ?? 0,
          Bands_Calculation_Mode: settings?.bandsCalculationMode ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.bandsCalculationMode ?? 'Standard Deviation',
          band_1: settings?.band1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band1 ?? true,
          Bands_Multiplier_1: settings?.vwapBandsMultiplier1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier1 ?? 1,
          band_2: settings?.band2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band2 ?? false,
          Bands_Multiplier_2: settings?.vwapBandsMultiplier2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier2 ?? 2,
          band_3: settings?.band3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band3 ?? false,
          Bands_Multiplier_3: settings?.vwapBandsMultiplier3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier3 ?? 3,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'BollingerBands',
        id: 'STD;Bollinger_Bands',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.length ?? 20,
          Basis_MA_Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.maType ?? 'SMA',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.source ?? 'close',
          StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.bbStdDev ?? 2,
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.offset ?? 0,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'CandlestickPatterns',
        id: 'STD;Candlestick%1Pattern%1All%1Candlestick%1Patterns',
        inputs: (settings: IndicatorSettings) => ({
          Detect_Trend_Based_On: settings?.trendRule ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.trendRule ?? 'SMA50',
          Pattern_Type: settings?.patternType ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternType ?? 'Both',
          ...settings?.patternSettings ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternSettings,
        })
      },
      {
        name: 'Nadaraya-Watson-LuxAlgo',
        id: 'PUB;6d9015a1d65f4b53acaa7210554c446b',
        inputs: (settings: IndicatorSettings) => ({
          Bandwidth: settings?.Bandwidth ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Bandwidth ?? 8,
          mult: settings?.mult ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.mult ?? 3,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Source ?? 'close',
          Repainting_Smoothing: settings?.Repainting_Smoothing ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Repainting_Smoothing ?? true,
        }),
      },
      {
        name: 'SRv2',
        id: 'PUB;svbUudRasDCWzr86ZxLrL2erJrnv0h1x',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_Period: settings?.Pivot_Period ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Pivot_Period ?? 10,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Source ?? 'High/Low',
          _Maximum_Number_of_Pivot: settings?.Maximum_Number_of_Pivot ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_Pivot ?? 20,
          Maximum_Channel_Width_: settings?.Maximum_Channel_Width_ ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Channel_Width_ ?? 10,
          _Maximum_Number_of_SR: settings?.Maximum_Number_of_SR ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_SR ?? 5,
          _Minimum_Strength: settings?.Minimum_Strength ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Minimum_Strength ?? 2,
          Label_Location: settings?.Label_Location ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Label_Location ?? 20,
        }),
      },
      {
        name: 'Pivot Points High Low',
        id: 'STD;Pivot%1Points%1High%1Low',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_High: settings?.Pivot_High ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_High ?? 10,
          Pivot_Low: settings?.Pivot_Low ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_Low ?? 10,
        }),
      },
      {
        name: 'Pivot Points Standard',
        id: 'STD;Pivot%1Points%1Standard',
        inputs: (settings: IndicatorSettings) => ({
          Type: settings?.Type ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Type ?? 'Traditional',
          Pivots_Timeframe: settings?.Pivots_Timeframe ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Pivots_Timeframe ?? 'Auto',
          Number_of_Pivots_Back: settings?.Number_of_Pivots_Back ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Number_of_Pivots_Back ?? 15,
          Use_Dailybased_Values: settings?.Use_Dailybased_Values ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Use_Dailybased_Values ?? true,
        }),
      },
    ];

    const mainIndicators = tvIndicators.filter(ind => 
      !['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );
    const specialIndicators = tvIndicators.filter(ind => 
      ['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );

    await this.fetchMainIndicators(mainIndicators, indicatorsMap, symbolsToSetup);
    await this.fetchSpecialIndicators(specialIndicators, symbolsToSetup);
    await this.fetchMarketPrice(symbolsToSetup);
  }

  private async fetchMarketPrice(symbolsToSetup: string[]) {
    if (!this.structuredData) {
      this.structuredData = {};
    }

    for (const symbol of symbolsToSetup) {
      if (!this.structuredData[symbol]) {
        this.structuredData[symbol] = {};
      }

      const creds = this.tvCredentials[symbol];
      if (!creds || !creds.session || !creds.signature) {
        this.logger.error(`Invalid TradingView credentials for ${symbol}`);
        continue;
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      const key = `${symbol}:marketPrice`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe: '1', fetchOptions: { agent: new HttpsProxyAgent(this.marketPriceProxy) } });
      this.charts[key] = chart;

      let lastUpdateTime = Date.now();

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${symbol} `);
      });

      chart.onUpdate(() => {
        const periods = chart.periods || [];
        const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : {};
        this.structuredData[symbol].marketPrice = latest.close;
        this.structuredData[symbol].volume = latest.volume;
        const priceEmitValues: { [key: string]: any } = { symbol, marketPrice: latest.close, volume: latest.volume };
        this.socketService.emitLiveDataAll(priceEmitValues);
        lastUpdateTime = Date.now();
        this.lastUpdateTime = latest.time * 1000;
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for market price on ${symbol}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        clearInterval(this.chartTimeouts[key]);
        setTimeout(() => this.fetchMarketPrice([symbol]), 5000);
      });
    }
  }

  private async fetchMainIndicators(indicators: any[], indicatorsMap: Record<string, any>, symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }
    }

    for (const { name, id, inputs } of indicators) {
      if (!this.indicatorList.includes(name)) continue;

      const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbolsToSetup[0]));
      try {
        indicatorsMap[name] = await getIndicator(id, undefined, { agent: proxyAgent });
      } catch (err) {
        this.logger.error(`Failed to load indicator ${name}: ${err.message}`, err.stack);
        continue;
      }

      for (const symbol of symbolsToSetup) {
        const client = this.tvClients[symbol];
        if (!client) {
          this.logger.error(`No TradingView client for ${symbol}`);
          continue;
        }

        for (const timeframe of this.timeframes) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key];
          try {
            const inputValues = inputs(settings || {});
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicatorsMap[name].setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            continue;
          }

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe });
          const study = new chart.Study(indicatorsMap[name]);
          this.charts[key] = chart;

          let lastUpdateTime = Date.now();

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
          });

          study.onReady(() => {
            this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
          });

          study.onUpdate(() => {
            const periods = study.periods || [];
            const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
            structuredData[symbol][timeframe][name] = latest;
           // this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
            lastUpdateTime = Date.now();
            this.emitCombinedData(structuredData);
          });

          study.onError((...err: any[]) => {
            this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
            setTimeout(() => this.setupIndicatorsAndPrice(symbol), 5000); // Corrected to call setupIndicatorsAndPrice
          });

          chart.onError((err: any) => {
            this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
            setTimeout(() => this.setupIndicatorsAndPrice(symbol), 5000); // Corrected to call setupIndicatorsAndPrice
          });
        }
      }
    }
  }

  private async fetchSpecialIndicators(indicators: any[], symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      for (const timeframe of this.timeframes) {
        for (const { name, id, inputs } of indicators) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key] || {};
          const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbol));

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe, range: 500 });
          this.charts[key] = chart;

          let lastUpdateTime = Date.now();

          const indicator = await TradingView.getIndicator(id, undefined, { agent: proxyAgent }).catch((err) => {
            this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            throw err;
          });

          this.logger.log(`Available inputs for ${name} on ${symbol}:${timeframe}:`, JSON.stringify(indicator.inputs, null, 2));

          try {
            const inputValues = inputs(settings);
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicator.setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            chart.delete();
            continue;
          }

          const STD = new chart.Study(indicator);

          STD.onError((...err) => {
            this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
          });

          STD.onReady(() => {
            this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
          });

          STD.onUpdate(() => {
            setTimeout(() => {
              const reverseArrays = (obj: any): any => {
                if (Array.isArray(obj)) {
                  return [...obj].reverse();
                } else if (obj && typeof obj === 'object') {
                  const result: any = {};
                  for (const [key, value] of Object.entries(obj)) {
                    result[key] = reverseArrays(value);
                  }
                  return result;
                }
                return obj;
              };

              let data = STD.graphic ? reverseArrays(STD.graphic) : null;

              if (name === 'SRv2' && data && data.labels) {
                data = { labels: data.labels };
              }

              if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
                data = {
                  lines: data.lines
                    .filter((line: any) => line.y1 != null && line.y2 != null)
                    .slice(-2),
                };
              }

              if (name === 'Pivot Points High Low' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 10),
                };
              }

              if (name === 'Pivot Points Standard' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 11),
                };
              }

              structuredData[symbol][timeframe][name] = data;
              this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
              lastUpdateTime = Date.now();
              this.emitCombinedData(structuredData);
            });
          });

          chart.onError((err: Error) => {
            this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
            setTimeout(() => this.setupSpecialChart(symbol, timeframe, id, name, inputs), 5000);
          });

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
          });
        }
      }
    }
  }

  private async setupSpecialChart(symbol: string, timeframe: string, id: string, name: string, inputs: (settings: IndicatorSettings) => any) {
    const key = `${symbol}:${timeframe}:${name}`;
    const settings = this.indicatorSettings[key] || {};
    const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbol));

    const client = this.tvClients[symbol];
    if (!client) {
      this.logger.error(`No TradingView client for ${symbol}`);
      return;
    }

    const chart = new client.Session.Chart();
    chart.setMarket(symbol, { timeframe, range: 500 });
    this.charts[key] = chart;

    const indicator = await TradingView.getIndicator(id, undefined, { agent: proxyAgent }).catch((err) => {
      this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
      chart.delete();
      throw err;
    });

    try {
      const inputValues = inputs(settings);
      for (const [key, value] of Object.entries(inputValues)) {
        if (value !== undefined && value !== null) {
          indicator.setOption(key, value);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
      chart.delete();
      return;
    }

    const STD = new chart.Study(indicator);

    STD.onError((...err) => {
      this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
      chart.delete();
      delete this.charts[key];
      clearInterval(this.chartTimeouts[key]);
      setTimeout(() => this.setupSpecialChart(symbol, timeframe, id, name, inputs), 5000);
    });

    STD.onReady(() => {
      this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
    });

    STD.onUpdate(() => {
      setTimeout(() => {
        const reverseArrays = (obj: any): any => {
          if (Array.isArray(obj)) {
            return [...obj].reverse();
          } else if (obj && typeof obj === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
              result[key] = reverseArrays(value);
            }
            return result;
          }
          return obj;
        };

        let data = STD.graphic ? reverseArrays(STD.graphic) : null;

        if (name === 'SRv2' && data && data.labels) {
          data = { labels: data.labels };
        }

        if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
          data = {
            lines: data.lines
              .filter((line: any) => line.y1 != null && line.y2 != null)
              .slice(-2),
          };
        }

        if (name === 'Pivot Points High Low' && data && data.labels) {
          data = {
            labels: data.labels
              .filter((label: any) => label.y != null)
              .sort((a: any, b: any) => b.id - a.id)
              .slice(0, 10),
          };
        }

        if (name === 'Pivot Points Standard' && data && data.labels) {
          data = {
            labels: data.labels
              .filter((label: any) => label.y != null)
              .sort((a: any, b: any) => b.id - a.id)
              .slice(0, 11),
          };
        }

        this.structuredData[symbol][timeframe][name] = data;
      //  this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
        this.emitCombinedData(this.structuredData);
      });
    });

    chart.onError((err: Error) => {
      this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
      chart.delete();
      delete this.charts[key];
      clearInterval(this.chartTimeouts[key]);
      setTimeout(() => this.setupSpecialChart(symbol, timeframe, id, name, inputs), 5000);
    });

    chart.onSymbolLoaded(() => {
      this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
    });
  }

  private async emitCombinedData(indicatorData: Record<string, any>) {
    try {
      const combinedData: Record<string, any> = {};
      for (const symbol of this.symbols) {
        combinedData[symbol] = indicatorData[symbol] || {};
        for (const timeframe of this.timeframes) {
          combinedData[symbol][timeframe] = combinedData[symbol][timeframe] || {};
        }
      }
      await this.calculateAndEmitIndicators(combinedData);
    } catch (error) {
      this.logger.error(`Error emitting combined data: ${error.message}`, error.stack);
    }
  }

  async calculateAndEmitIndicators(data: Record<string, any>): Promise<void> {
    try {
      for (const symbol of this.symbols) {
        const enabledTimeframes = this.emissionSettings[symbol]?.enabledTimeframes || this.timeframes;
        const enabledIndicators = this.emissionSettings[symbol]?.enabledIndicators || this.indicatorList;

        for (const timeframe of enabledTimeframes) {
          const emitValues: { [key: string]: any } = { symbol, timeframe };

          for (const indicator of enabledIndicators) {
            const key = `${symbol}:${timeframe}:${indicator}`;
            if (data[symbol] && data[symbol][timeframe] && data[symbol][timeframe][indicator]) {
              const indicatorValue = data[symbol][timeframe][indicator];
              if (!this.isInvalidResult(indicatorValue)) {
                emitValues[indicator] = indicatorValue;
              }
            }
          }

          if (Object.keys(emitValues).length > 0) {
            this.socketService.emitLiveDataAll(emitValues);
          } else {
           // this.logger.warn(`[${new Date().toISOString()}] No valid data to emit for ${symbol}:${timeframe}`);
          }
        }

        if (data[symbol] && data[symbol].marketPrice) {
          const priceEmitValues: { [key: string]: any } = { symbol };
          const priceValue = data[symbol].marketPrice;
          if (!this.isInvalidResult(priceValue)) {
            priceEmitValues['marketPrice'] = priceValue;
            priceEmitValues['volume'] = data[symbol].volume;
          //  this.logger.log(`[${new Date().toISOString()}] Emitting market price for ${symbol}:`, JSON.stringify(priceEmitValues, null, 2));
            this.socketService.emitLiveDataAll(priceEmitValues);
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to calculate and emit indicators: ${error.message}`);
    }
  }

  private isInvalidResult(result: any): boolean {
    if (result === null || result === undefined) return true;
    if (Array.isArray(result) && result.length === 0) return true;
    if (typeof result === 'object') {
      return Object.values(result).every(
        value =>
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && (value === 'N/A' || value === '0.00000'))
      );
    }
    return false;
  }

  async onModuleDestroy() {
    try {
      for (const symbol in this.tvClients) {
        if (this.tvClients[symbol]) {
          await this.tvClients[symbol].end();
          this.logger.verbose(`TradingView WS closed for ${symbol}`);
        }
      }
      for (const key in this.charts) {
        this.charts[key].delete();
      }
      for (const key in this.chartTimeouts) {
        clearInterval(this.chartTimeouts[key]);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup resources: ${error.message}`);
    }
  }
}

/*
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocketService } from 'src/common/websocket/socket.service';
import * as TradingViewModule from '@mathieuc/tradingview';
const { Client, getIndicator } = TradingViewModule;
import * as TradingView from '@mathieuc/tradingview';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface IndicatorSettings {
  indicator: 'EMA50' | 'EMA200' | 'RSI' | 'MACD' | 'FibonacciBollingerBands' | 'VWAP' | 'BollingerBands' | 'CandlestickPatterns' | 'Nadaraya-Watson-LuxAlgo' | 'SRv2' | 'Pivot Points High Low' | 'Pivot Points Standard';
  period?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4';
  offset?: number;
  latestValue?: number;
  length?: number;
  bbStdDev?: number;
  rsiLength?: number;
  maType?: 'None' | 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  macdSourceMaType?: 'SMA' | 'EMA';
  macdSignalMaType?: 'SMA' | 'EMA';
  fibLookback?: number;
  multiply?: number;
  vwapAnchor?: 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';
  vwapBandsMultiplier1?: number;
  vwapBandsMultiplier2?: number;
  vwapBandsMultiplier3?: number;
  hideVwapOn1DOrAbove?: boolean;
  bandsCalculationMode?: 'Standard Deviation' | 'Percentage';
  band1?: boolean;
  band2?: boolean;
  band3?: boolean;
  timeframeInput?: string;
  waitForTimeframeCloses?: boolean;
  calculateDivergence?: boolean;
  patternType?: 'Bullish' | 'Bearish' | 'Both';
  trendRule?: 'SMA50' | 'SMA50, SMA200' | 'No detection';
  patternSettings?: {
    Abandoned_Baby?: boolean;
    Dark_Cloud_Cover?: boolean;
    Doji?: boolean;
    Doji_Star?: boolean;
    Downside_Tasuki_Gap?: boolean;
    Dragonfly_Doji?: boolean;
    Engulfing?: boolean;
    Evening_Doji_Star?: boolean;
    Evening_Star?: boolean;
    Falling_Three_Methods?: boolean;
    Falling_Window?: boolean;
    Gravestone_Doji?: boolean;
    Hammer?: boolean;
    Hanging_Man?: boolean;
    Harami_Cross?: boolean;
    Harami?: boolean;
    Inverted_Hammer?: boolean;
    Kicking?: boolean;
    Long_Lower_Shadow?: boolean;
    Long_Upper_Shadow?: boolean;
    Marubozu_Black?: boolean;
    Marubozu_White?: boolean;
    Morning_Doji_Star?: boolean;
    Morning_Star?: boolean;
    On_Neck?: boolean;
    Piercing?: boolean;
    Rising_Three_Methods?: boolean;
    Rising_Window?: boolean;
    Shooting_Star?: boolean;
    Spinning_Top_Black?: boolean;
    Spinning_Top_White?: boolean;
    Three_Black_Crows?: boolean;
    Three_White_Soldiers?: boolean;
    TriStar?: boolean;
    Tweezer_Bottom?: boolean;
    Tweezer_Top?: boolean;
    Upside_Tasuki_Gap?: boolean;
  };
  Bandwidth?: number;
  mult?: number;
  Source?: 'close' | 'High/Low' | 'Close/Open';
  Repainting_Smoothing?: boolean;
  Pivot_Period?: number;
  Maximum_Number_of_Pivot?: number;
  Maximum_Channel_Width_?: number;
  Maximum_Number_of_SR?: number;
  Minimum_Strength?: number;
  Label_Location?: number;
  Line_Style?: 'Solid' | 'Dashed' | 'Dotted';
  Line_Width?: number;
  Show_Point_Points?: boolean;
  Pivot_High?: number;
  Pivot_Low?: number;
  Type?: 'Traditional' | 'Fibonacci' | 'Woodie' | 'Classic' | 'DM' | 'Camarilla';
  Pivots_Timeframe?: 'Auto' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Biyearly' | 'Triyearly' | 'Quinquennially' | 'Decennially';
  Number_of_Pivots_Back?: number;
  Use_Dailybased_Values?: boolean;
}

@Injectable()
export class IndicatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndicatorService.name);
  private indicatorSettings: { [key: string]: IndicatorSettings } = {};
  private emissionSettings: { [key: string]: { enabledIndicators: string[]; enabledTimeframes: string[] } } = {};
  private indicatorList: string[] = [
    'EMA50', 
    'EMA200', 
    'RSI', 
    'MACD',
    'FibonacciBollingerBands', 
    'VWAP', 
    'BollingerBands', 
    'CandlestickPatterns',
    'Nadaraya-Watson-LuxAlgo',
    'SRv2',
    'Pivot Points High Low',
    'Pivot Points Standard',
  ];
private symbols: string[] = [
    'VANTAGE:XAUUSD',
    'VANTAGE:GER40',
    'VANTAGE:NAS100',
    'BINANCE:BTCUSDT'
  ];
  private timeframes: string[] = [
    '15',
    '60',
    '240',
    '1D',
    '1W'
  ];
  private readonly tvCredentials: { [symbol: string]: { session: string; signature: string } } = {
   'VANTAGE:XAUUSD': { session: 'ah812nch1fjn50wh93nacny1nk286eyc', signature: 'v3:BVWFN51Qcwln48iw3Uz0WbWkxmiX2SbmbheoFmCruiE=' },
   'VANTAGE:GER40': { session: 's1ycepfkikx69v3dvifi1hzld2gxu4bn', signature: 'v3:uOHIyCVOqUJFYtZ6LoV+j20uGJEE0eOuJoYSZ0eMU6k=' },
    'VANTAGE:NAS100': { session: '1kw9xc2ckwvfjm46n022jjwj82wvkai0', signature: 'v3:NZqDSi4EqlcEM3AaK0McWdhtpeYRVhEM+m+XJgL30/M=' },
    'BINANCE:BTCUSDT': { session: 'c7bpt5jh7ohx5yrbjt8c5mxxfpjd3rnx', signature: 'v3:AMeke7FM58qjON6a6gIbhCZu5t1oSCPYyJ3XplXfaZk=' }
  };
  private readonly defaultSettings: IndicatorSettings[] = [
    { indicator: 'EMA50', period: 50, source: 'close', offset: 0, maType: 'EMA' },
    { indicator: 'EMA200', period: 200, source: 'close', offset: 0, maType: 'EMA' },
    { 
      indicator: 'RSI', 
      rsiLength: 14, 
      length: 14, 
      maType: 'SMA', 
      bbStdDev: 2, 
      source: 'close', 
      offset: 0,
      calculateDivergence: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'MACD', 
      macdFastPeriod: 12, 
      macdSlowPeriod: 26, 
      macdSignalPeriod: 9, 
      macdSourceMaType: 'EMA', 
      macdSignalMaType: 'EMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'FibonacciBollingerBands', 
      fibLookback: 200, 
      multiply: 3,
      source: 'hlc3' 
    },
    { 
      indicator: 'VWAP', 
      vwapAnchor: 'Session', 
      vwapBandsMultiplier1: 1, 
      vwapBandsMultiplier2: 2, 
      vwapBandsMultiplier3: 3, 
      source: 'hlc3',
      hideVwapOn1DOrAbove: false,
      bandsCalculationMode: 'Standard Deviation',
      offset: 0,
      band1: true,
      band2: false,
      band3: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'BollingerBands', 
      length: 20, 
      bbStdDev: 2, 
      maType: 'SMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'CandlestickPatterns', 
      patternType: 'Both', 
      trendRule: 'SMA50', 
      patternSettings: {
        Abandoned_Baby: true,
        Dark_Cloud_Cover: true,
        Doji: true,
        Doji_Star: true,
        Downside_Tasuki_Gap: true,
        Dragonfly_Doji: true,
        Engulfing: true,
        Evening_Doji_Star: true,
        Evening_Star: true,
        Falling_Three_Methods: true,
        Falling_Window: true,
        Gravestone_Doji: true,
        Hammer: true,
        Hanging_Man: true,
        Harami_Cross: true,
        Harami: true,
        Inverted_Hammer: true,
        Kicking: true,
        Long_Lower_Shadow: true,
        Long_Upper_Shadow: true,
        Marubozu_Black: true,
        Marubozu_White: true,
        Morning_Doji_Star: true,
        Morning_Star: true,
        On_Neck: true,
        Piercing: true,
        Rising_Three_Methods: true,
        Rising_Window: true,
        Shooting_Star: true,
        Spinning_Top_Black: true,
        Spinning_Top_White: true,
        Three_Black_Crows: true,
        Three_White_Soldiers: true,
        TriStar: true,
        Tweezer_Bottom: true,
        Tweezer_Top: true,
        Upside_Tasuki_Gap: true
      },
    },
    {
      indicator: 'Nadaraya-Watson-LuxAlgo',
      Bandwidth: 8,
      mult: 3,
      Source: 'close',
      Repainting_Smoothing: true,
    },
    {
      indicator: 'SRv2',
      Pivot_Period: 10,
      Source: 'High/Low',
      Maximum_Number_of_Pivot: 20,
      Maximum_Channel_Width_: 10,
      Maximum_Number_of_SR: 5,
      Minimum_Strength: 2,
      Label_Location: 20,
      Line_Style: 'Dashed',
      Line_Width: 2,
      Show_Point_Points: false,
    },
    {
      indicator: 'Pivot Points High Low',
      Pivot_High: 10,
      Pivot_Low: 10,
    },
    {
      indicator: 'Pivot Points Standard',
      Type: 'Traditional',
      Pivots_Timeframe: 'Auto',
      Number_of_Pivots_Back: 15,
      Use_Dailybased_Values: true,
    },
  ];
  private tvClients: { [symbol: string]: any } = {};
  private charts: { [key: string]: any } = {};
  private proxyList: string[] = [
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10004',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  ];
  private proxyAssignments: { [symbol: string]: string } = {
    'VANTAGE:XAUUSD': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'VANTAGE:GER40': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'VANTAGE:NAS100': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'BINANCE:BTCUSDT': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  };
  private marketPriceProxy: string = 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10005';
  structuredData: any = {};
  lastUpdateTime: number;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelayBase = 5000; // Base delay in ms
  private readonly proxyRetryInterval = 10000; // Time to wait before retrying a new proxy
  private chartTimeouts: { [key: string]: NodeJS.Timeout } = {}; // Track timeouts for all charts
  private reconnectAttempts: { [symbol: string]: number } = {};

  constructor(
    private readonly httpService: HttpService,
    @Inject('SOCKET_SERVICE') private socketService: SocketService,
    @InjectModel('IndicatorSettings') private indicatorSettingsModel: Model<any>,
    @InjectModel('EmissionSettings') private emissionSettingsModel: Model<any>,
  ) {}

  private getProxyForSymbol(symbol: string): string {
    const assignedProxy = this.proxyAssignments[symbol];
    if (assignedProxy && this.isProxyAlive(assignedProxy)) {
      return assignedProxy;
    }
    // Fallback to a random proxy from the list
    const availableProxies = this.proxyList.filter(proxy => proxy !== assignedProxy && this.isProxyAlive(proxy));
    const fallbackProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)] || this.proxyList[0];
    this.logger.warn(`[${new Date().toISOString()}] Proxy for ${symbol} failed, falling back to ${fallbackProxy}`);
    this.proxyAssignments[symbol] = fallbackProxy; // Update assignment
    return fallbackProxy;
  }

  private isProxyAlive(proxyUrl: string): boolean {
    // Placeholder: In a real implementation, you could ping the proxy or track recent failures
    return true;
  }

  async onModuleInit() {
    try {
      this.logger.log(`[${new Date().toISOString()}] Server starting`);
      await this.initializeVantageData();
      await this.initializeTradingView();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Server startup failed: ${error.message}`);
      throw error;
    }
  }



  private async initializeTradingView() {
    try {
      for (const symbol of this.symbols) {
        const creds = this.tvCredentials[symbol];
        if (!creds || !creds.session || !creds.signature) {
          this.logger.error(`Missing TradingView session or signature for ${symbol}`);
          throw new Error(`Missing TradingView session or signature for ${symbol}`);
        }
        const proxyUrl = this.getProxyForSymbol(symbol);
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        this.tvClients[symbol] = new Client({
          token: creds.session,
          signature: creds.signature,
          fetchOptions: {
            agent: proxyAgent,
          },
        });
        
        this.tvClients[symbol].onError((err: Error) => {
          try {
            this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
            this.reinitializeClient(symbol);
          } catch (error) {
            this.logger.error(`Failed during error handling for ${symbol}: ${error.message}`, error.stack);
          }
        });
        this.logger.verbose(`TradingView WS connected for ${symbol} using proxy ${proxyUrl}`);
      }
      await this.setupIndicatorsAndPrice();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] TradingView initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async reinitializeClient(symbol: string, attempt: number = 1) {
    try {
      if (this.reconnectAttempts[symbol] >= this.maxReconnectAttempts) {
        this.logger.error(`[${new Date().toISOString()}] Max reconnect attempts reached for ${symbol}`);
        return;
      }

      this.reconnectAttempts[symbol] = (this.reconnectAttempts[symbol] || 0) + 1;
      if (this.tvClients[symbol]) {
        await this.tvClients[symbol].end();
        this.tvClients[symbol] = null;
      }
      const creds = this.tvCredentials[symbol];
      const proxyUrl = this.getProxyForSymbol(symbol);
      const proxyAgent = new HttpsProxyAgent(proxyUrl);
      this.tvClients[symbol] = new Client({
        token: creds.session,
        signature: creds.signature,
        fetchOptions: {
          agent: proxyAgent,
        },
      });
      this.tvClients[symbol].onError((err: Error) => {
        this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
        setTimeout(() => this.reinitializeClient(symbol, attempt + 1), this.reconnectDelayBase * Math.pow(2, attempt));
      });
      this.logger.verbose(`TradingView WS reconnected for ${symbol} using proxy ${proxyUrl} (attempt ${attempt})`);
      this.reconnectAttempts[symbol] = 0;
      await this.setupIndicatorsAndPrice(symbol);
    } catch (error) {
      this.logger.error(`Failed to reinitialize client for ${symbol} (attempt ${attempt}): ${error.message}`);
      setTimeout(() => this.reinitializeClient(symbol, attempt + 1), this.reconnectDelayBase * Math.pow(2, attempt));
    }
  }

  private async initializeVantageData() {
    try {
      const emissionSettings = await this.emissionSettingsModel.find().exec();
      emissionSettings.forEach(settings => {
        this.emissionSettings[settings.symbol] = {
          enabledIndicators: settings.enabledIndicators,
          enabledTimeframes: settings.enabledTimeframes,
        };
      });
      await this.loadIndicatorSettings();
      await this.loadEmissionSettings();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async loadIndicatorSettings() {
    try {
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          for (const defaultSetting of this.defaultSettings) {
            const key = `${symbol}:${timeframe}:${defaultSetting.indicator}`;
            const existingSettings = await this.indicatorSettingsModel
              .findOne({ symbol, timeframe, indicator: defaultSetting.indicator })
              .exec();
            if (existingSettings) {
              this.indicatorSettings[key] = { ...existingSettings.toObject() };
              loadedSettingsCount++;
            } else {
              const newSettings = { symbol, timeframe, symbolTimeframeIndicator: key, ...defaultSetting };
              await this.indicatorSettingsModel
                .findOneAndUpdate(
                  { symbol, timeframe, indicator: defaultSetting.indicator },
                  newSettings,
                  { upsert: true, new: true }
                )
                .exec();
              this.indicatorSettings[key] = { ...defaultSetting };
              this.logger.log(`[${new Date().toISOString()}] Initialized default indicator settings for ${key}`);
            }
          }
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} indicator settings from MongoDB`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load indicator settings: ${error.message}`);
      throw error;
    }
  }

  private async loadEmissionSettings() {
    try {
      const defaultEmissionSettings = {
        enabledIndicators: this.indicatorList,
        enabledTimeframes: this.timeframes,
      };
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        const existingSettings = await this.emissionSettingsModel
          .findOne({ symbol })
          .exec();
        if (existingSettings) {
          this.emissionSettings[symbol] = {
            enabledIndicators: existingSettings.enabledIndicators,
            enabledTimeframes: existingSettings.enabledTimeframes,
          };
          loadedSettingsCount++;
        } else {
          const newSettings = { symbol, ...defaultEmissionSettings };
          await this.emissionSettingsModel
            .findOneAndUpdate({ symbol }, newSettings, { upsert: true, new: true })
            .exec();
          this.emissionSettings[symbol] = { ...defaultEmissionSettings };
          this.logger.log(`[${new Date().toISOString()}] Initialized default emission settings for ${symbol}`);
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} emission settings from MongoDB, initialized ${this.symbols.length - loadedSettingsCount} with defaults`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load emission settings: ${error.message}`);
      throw error;
    }
  }

  async saveIndicatorSettings(settings: IndicatorSettings & { symbol: string; timeframe: string; indicator: string }) {
    try {
      const key = `${settings.symbol}:${settings.timeframe}:${settings.indicator}`;
      await this.indicatorSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol, timeframe: settings.timeframe, indicator: settings.indicator },
          { ...settings, symbolTimeframeIndicator: key },
          { upsert: true, new: true }
        )
        .exec();
      this.indicatorSettings[key] = { ...settings };
      this.logger.log(`[${new Date().toISOString()}] Saved indicator settings for ${key}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Settings saved' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save indicator settings for ${settings.symbol}:${settings.timeframe}:${settings.indicator}: ${error.message}`);
      throw error;
    }
  }

  async saveEmissionSettings(settings: { symbol: string; enabledIndicators: string[]; enabledTimeframes: string[] }) {
    try {
      await this.emissionSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol },
          settings,
          { upsert: true, new: true }
        )
        .exec();
      this.emissionSettings[settings.symbol] = {
        enabledIndicators: settings.enabledIndicators,
        enabledTimeframes: settings.enabledTimeframes,
      };
      this.logger.log(`[${new Date().toISOString()}] Saved emission settings for ${settings.symbol}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Emission settings updated successfully' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save emission settings for ${settings.symbol}: ${error.message}`);
      throw error;
    }
  }

  async getIndicatorSettings(symbol: string, timeframe: string) {
    try {
      const settings = await this.indicatorSettingsModel
        .find({ symbol, timeframe })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched indicator settings for ${symbol}:${timeframe}:`, JSON.stringify(settings, null, 2));
      return settings.length > 0 ? settings : null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch indicator settings for ${symbol}:${timeframe}: ${error.message}`);
      throw error;
    }
  }

  async getEmissionSettings(symbol: string) {
    try {
      const settings = await this.emissionSettingsModel
        .findOne({ symbol })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched emission settings for ${symbol}:`, JSON.stringify(settings, null, 2));
      return settings || null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch emission settings for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  private async setupIndicatorsAndPrice(symbol?: string) {
    const symbolsToSetup = symbol ? [symbol] : this.symbols;
    const indicatorsMap: Record<string, any> = {};
    const tvIndicators = [
      {
        name: 'EMA50',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.period ?? 50,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.maType ?? 'EMA'
        })
      },
      {
        name: 'EMA200',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.period ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.maType ?? 'EMA'
        })
      },
      {
        name: 'RSI',
        id: 'STD;RSI',
        inputs: (settings: IndicatorSettings) => ({
          RSI_Length: settings?.rsiLength ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.rsiLength ?? 14,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.source ?? 'close',
          Calculate_Divergence: settings?.calculateDivergence ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.calculateDivergence ?? false,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.maType ?? 'SMA',
          Length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.length ?? 14,
          BB_StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.bbStdDev ?? 2,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'MACD',
        id: 'STD;MACD',
        inputs: (settings: IndicatorSettings) => ({
          Fast_Length: settings?.macdFastPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdFastPeriod ?? 12,
          Slow_Length: settings?.macdSlowPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSlowPeriod ?? 26,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.source ?? 'close',
          Signal_Smoothing: settings?.macdSignalPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalPeriod ?? 9,
          Oscillator_MA_Type: settings?.macdSourceMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSourceMaType ?? 'EMA',
          Signal_Line_MA_Type: settings?.macdSignalMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalMaType ?? 'EMA',
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'FibonacciBollingerBands',
        id: 'PUB;2835',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.fibLookback ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.fibLookback ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.source ?? 'hlc3',
          mult: settings?.multiply ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.multiply ?? 3
        })
      },
      {
        name: 'VWAP',
        id: 'STD;VWAP',
        inputs: (settings: IndicatorSettings) => ({
          Hide_VWAP_on_1D_or_Above: settings?.hideVwapOn1DOrAbove ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.hideVwapOn1DOrAbove ?? false,
          Anchor_Period: settings?.vwapAnchor ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapAnchor ?? 'Session',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.source ?? 'hlc3',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.offset ?? 0,
          Bands_Calculation_Mode: settings?.bandsCalculationMode ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.bandsCalculationMode ?? 'Standard Deviation',
          band_1: settings?.band1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band1 ?? true,
          Bands_Multiplier_1: settings?.vwapBandsMultiplier1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier1 ?? 1,
          band_2: settings?.band2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band2 ?? false,
          Bands_Multiplier_2: settings?.vwapBandsMultiplier2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier2 ?? 2,
          band_3: settings?.band3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band3 ?? false,
          Bands_Multiplier_3: settings?.vwapBandsMultiplier3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier3 ?? 3,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'BollingerBands',
        id: 'STD;Bollinger_Bands',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.length ?? 20,
          Basis_MA_Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.maType ?? 'SMA',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.source ?? 'close',
          StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.bbStdDev ?? 2,
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.offset ?? 0,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'CandlestickPatterns',
        id: 'STD;Candlestick%1Pattern%1All%1Candlestick%1Patterns',
        inputs: (settings: IndicatorSettings) => ({
          Detect_Trend_Based_On: settings?.trendRule ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.trendRule ?? 'SMA50',
          Pattern_Type: settings?.patternType ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternType ?? 'Both',
          ...settings?.patternSettings ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternSettings,
        })
      },
      {
        name: 'Nadaraya-Watson-LuxAlgo',
        id: 'PUB;6d9015a1d65f4b53acaa7210554c446b',
        inputs: (settings: IndicatorSettings) => ({
          Bandwidth: settings?.Bandwidth ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Bandwidth ?? 8,
          mult: settings?.mult ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.mult ?? 3,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Source ?? 'close',
          Repainting_Smoothing: settings?.Repainting_Smoothing ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Repainting_Smoothing ?? true,
        }),
      },
      {
        name: 'SRv2',
        id: 'PUB;svbUudRasDCWzr86ZxLrL2erJrnv0h1x',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_Period: settings?.Pivot_Period ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Pivot_Period ?? 10,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Source ?? 'High/Low',
          _Maximum_Number_of_Pivot: settings?.Maximum_Number_of_Pivot ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_Pivot ?? 20,
          Maximum_Channel_Width_: settings?.Maximum_Channel_Width_ ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Channel_Width_ ?? 10,
          _Maximum_Number_of_SR: settings?.Maximum_Number_of_SR ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_SR ?? 5,
          _Minimum_Strength: settings?.Minimum_Strength ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Minimum_Strength ?? 2,
          Label_Location: settings?.Label_Location ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Label_Location ?? 20,
        }),
      },
      {
        name: 'Pivot Points High Low',
        id: 'STD;Pivot%1Points%1High%1Low',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_High: settings?.Pivot_High ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_High ?? 10,
          Pivot_Low: settings?.Pivot_Low ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_Low ?? 10,
        }),
      },
      {
        name: 'Pivot Points Standard',
        id: 'STD;Pivot%1Points%1Standard',
        inputs: (settings: IndicatorSettings) => ({
          Type: settings?.Type ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Type ?? 'Traditional',
          Pivots_Timeframe: settings?.Pivots_Timeframe ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Pivots_Timeframe ?? 'Auto',
          Number_of_Pivots_Back: settings?.Number_of_Pivots_Back ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Number_of_Pivots_Back ?? 15,
          Use_Dailybased_Values: settings?.Use_Dailybased_Values ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Use_Dailybased_Values ?? true,
        }),
      },
    ];

    const mainIndicators = tvIndicators.filter(ind => 
      !['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );
    const specialIndicators = tvIndicators.filter(ind => 
      ['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );

    await this.fetchMainIndicators(mainIndicators, indicatorsMap, symbolsToSetup);
    await this.fetchSpecialIndicators(specialIndicators, symbolsToSetup);
    await this.fetchMarketPrice(symbolsToSetup);
  }

  private async fetchMarketPrice(symbolsToSetup: string[]) {
    if (!this.structuredData) {
      this.structuredData = {};
    }

    for (const symbol of symbolsToSetup) {
      if (!this.structuredData[symbol]) {
        this.structuredData[symbol] = {};
      }

      const creds = this.tvCredentials[symbol];
      if (!creds || !creds.session || !creds.signature) {
        this.logger.error(`Invalid TradingView credentials for ${symbol}`);
        continue;
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      const key = `${symbol}:marketPrice`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe: '1', fetchOptions: { agent: new HttpsProxyAgent(this.marketPriceProxy) } });
      this.charts[key] = chart;

      let lastUpdateTime = Date.now();

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${symbol} `);
      });

      chart.onUpdate(() => {
        const periods = chart.periods || [];
        const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : {};
        this.structuredData[symbol].marketPrice = latest.close;
        this.structuredData[symbol].volume = latest.volume;
        const priceEmitValues: { [key: string]: any } = { symbol, marketPrice: latest.close, volume: latest.volume };
       // this.logger.log(`[${new Date(latest.time * 1000).toISOString()}] Emitting market price and volume for ${symbol}: ${JSON.stringify({ close: latest.close, volume: latest.volume })}`);
        this.socketService.emitLiveDataAll(priceEmitValues);
       // this.logger.debug(`Emitted data: ${JSON.stringify(priceEmitValues)}`);
        lastUpdateTime = Date.now();
        this.lastUpdateTime = latest.time * 1000;
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for market price on ${symbol}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        clearInterval(this.chartTimeouts[key]);
        setTimeout(() => this.fetchMarketPrice([symbol]), 5000);
      });

    }
  }

  private async fetchMainIndicators(indicators: any[], indicatorsMap: Record<string, any>, symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }
    }

    for (const { name, id, inputs } of indicators) {
      if (!this.indicatorList.includes(name)) continue;

      const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbolsToSetup[0]));
      try {
        indicatorsMap[name] = await getIndicator(id, undefined, { agent: proxyAgent });
      } catch (err) {
        this.logger.error(`Failed to load indicator ${name}: ${err.message}`, err.stack);
        continue;
      }

      for (const symbol of symbolsToSetup) {
        const client = this.tvClients[symbol];
        if (!client) {
          this.logger.error(`No TradingView client for ${symbol}`);
          continue;
        }

        for (const timeframe of this.timeframes) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key];
          try {
            const inputValues = inputs(settings || {});
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicatorsMap[name].setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            continue;
          }

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe });
          const study = new chart.Study(indicatorsMap[name]);
          this.charts[key] = chart;

          let lastUpdateTime = Date.now();

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
          });

          study.onReady(() => {
            this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
          });

          study.onUpdate(() => {
            const periods = study.periods || [];
            const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
            structuredData[symbol][timeframe][name] = latest;
            this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
            lastUpdateTime = Date.now();
            this.emitCombinedData(structuredData);
          });

          study.onError((...err: any[]) => {
            this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
             setTimeout(() => this.fetchMainIndicators(symbol, timeframe), 5000);
          });

          chart.onError((err: any) => {
            this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
            setTimeout(() => this.fetchMainIndicators(symbol, timeframe), 5000);
          });

 
        }
      }
    }
  }

 

  private async fetchSpecialIndicators(indicators: any[], symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      for (const timeframe of this.timeframes) {
        for (const { name, id, inputs } of indicators) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key] || {};
          const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbol));

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe, range: 500 });
          this.charts[key] = chart;

          let lastUpdateTime = Date.now();

          const indicator = await TradingView.getIndicator(id, undefined, { agent: proxyAgent }).catch((err) => {
            this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            throw err;
          });

          this.logger.log(`Available inputs for ${name} on ${symbol}:${timeframe}:`, JSON.stringify(indicator.inputs, null, 2));

          try {
            const inputValues = inputs(settings);
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicator.setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            chart.delete();
            continue;
          }

          const STD = new chart.Study(indicator);

          STD.onError((...err) => {
            this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
          });

          STD.onReady(() => {
            this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
          });

          STD.onUpdate(() => {
            setTimeout(() => {
              const reverseArrays = (obj: any): any => {
                if (Array.isArray(obj)) {
                  return [...obj].reverse();
                } else if (obj && typeof obj === 'object') {
                  const result: any = {};
                  for (const [key, value] of Object.entries(obj)) {
                    result[key] = reverseArrays(value);
                  }
                  return result;
                }
                return obj;
              };

              let data = STD.graphic ? reverseArrays(STD.graphic) : null;

              if (name === 'SRv2' && data && data.labels) {
                data = { labels: data.labels };
              }

              if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
                data = {
                  lines: data.lines
                    .filter((line: any) => line.y1 != null && line.y2 != null)
                    .slice(-2),
                };
              }

              if (name === 'Pivot Points High Low' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 10),
                };
              }

              if (name === 'Pivot Points Standard' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 11),
                };
              }

              structuredData[symbol][timeframe][name] = data;
              this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
              lastUpdateTime = Date.now();
              this.emitCombinedData(structuredData);
            });
          });

          chart.onError((err: Error) => {
            this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            delete this.charts[key];
            clearInterval(this.chartTimeouts[key]);
            setTimeout(() => this.setupSpecialChart(symbol, timeframe, id, name, inputs), 5000);
          });

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
          });
        }
      }
    }
  }

 

  private async emitCombinedData(indicatorData: Record<string, any>) {
    try {
      const combinedData: Record<string, any> = {};
      for (const symbol of this.symbols) {
        combinedData[symbol] = indicatorData[symbol] || {};
        for (const timeframe of this.timeframes) {
          combinedData[symbol][timeframe] = combinedData[symbol][timeframe] || {};
        }
      }
      await this.calculateAndEmitIndicators(combinedData);
    } catch (error) {
      this.logger.error(`Error emitting combined data: ${error.message}`, error.stack);
    }
  }

  async calculateAndEmitIndicators(data: Record<string, any>): Promise<void> {
    try {
      for (const symbol of this.symbols) {
        const enabledTimeframes = this.emissionSettings[symbol]?.enabledTimeframes || this.timeframes;
        const enabledIndicators = this.emissionSettings[symbol]?.enabledIndicators || this.indicatorList;

        for (const timeframe of enabledTimeframes) {
          const emitValues: { [key: string]: any } = { symbol, timeframe };

          for (const indicator of enabledIndicators) {
            const key = `${symbol}:${timeframe}:${indicator}`;
            if (data[symbol] && data[symbol][timeframe] && data[symbol][timeframe][indicator]) {
              const indicatorValue = data[symbol][timeframe][indicator];
              if (!this.isInvalidResult(indicatorValue)) {
                emitValues[indicator] = indicatorValue;
              }
            }
          }

          if (Object.keys(emitValues).length > 2) {
            this.socketService.emitLiveDataAll(emitValues);
          } else {
            this.logger.warn(`[${new Date().toISOString()}] No valid data to emit for ${symbol}:${timeframe}`);
          }
        }

        if (data[symbol] && data[symbol].marketPrice) {
          const priceEmitValues: { [key: string]: any } = { symbol };
          const priceValue = data[symbol].marketPrice;
          if (!this.isInvalidResult(priceValue)) {
            priceEmitValues['marketPrice'] = priceValue;
            priceEmitValues['volume'] = data[symbol].volume;
            this.logger.log(`[${new Date().toISOString()}] Emitting market price for ${symbol}:`, JSON.stringify(priceEmitValues, null, 2));
            this.socketService.emitLiveDataAll(priceEmitValues);
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to calculate and emit indicators: ${error.message}`);
    }
  }

  private isInvalidResult(result: any): boolean {
    if (result === null || result === undefined) return true;
    if (Array.isArray(result) && result.length === 0) return true;
    if (typeof result === 'object') {
      return Object.values(result).every(
        value =>
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && (value === 'N/A' || value === '0.00000'))
      );
    }
    return false;
  }

  async onModuleDestroy() {
    try {
      for (const symbol in this.tvClients) {
        if (this.tvClients[symbol]) {
          await this.tvClients[symbol].end();
          this.logger.verbose(`TradingView WS closed for ${symbol}`);
        }
      }
      for (const key in this.charts) {
        this.charts[key].delete();
      }
      for (const key in this.chartTimeouts) {
        clearInterval(this.chartTimeouts[key]);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup resources: ${error.message}`);
    }
  }
}








/*
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocketService } from 'src/common/websocket/socket.service';
import * as TradingViewModule from '@mathieuc/tradingview';
const { Client, getIndicator } = TradingViewModule;
import * as TradingView from '@mathieuc/tradingview';
import { HttpsProxyAgent } from 'https-proxy-agent';

interface IndicatorSettings {
  indicator: 'EMA50' | 'EMA200' | 'RSI' | 'MACD' | 'FibonacciBollingerBands' | 'VWAP' | 'BollingerBands' | 'CandlestickPatterns' | 'Nadaraya-Watson-LuxAlgo' | 'SRv2' | 'Pivot Points High Low' | 'Pivot Points Standard';
  period?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4';
  offset?: number;
  latestValue?: number;
  length?: number;
  bbStdDev?: number;
  rsiLength?: number;
  maType?: 'None' | 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  macdSourceMaType?: 'SMA' | 'EMA';
  macdSignalMaType?: 'SMA' | 'EMA';
  fibLookback?: number;
  multiply?: number;
  vwapAnchor?: 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';
  vwapBandsMultiplier1?: number;
  vwapBandsMultiplier2?: number;
  vwapBandsMultiplier3?: number;
  hideVwapOn1DOrAbove?: boolean;
  bandsCalculationMode?: 'Standard Deviation' | 'Percentage';
  band1?: boolean;
  band2?: boolean;
  band3?: boolean;
  timeframeInput?: string;
  waitForTimeframeCloses?: boolean;
  calculateDivergence?: boolean;
  patternType?: 'Bullish' | 'Bearish' | 'Both';
  trendRule?: 'SMA50' | 'SMA50, SMA200' | 'No detection';
  patternSettings?: {
    Abandoned_Baby?: boolean;
    Dark_Cloud_Cover?: boolean;
    Doji?: boolean;
    Doji_Star?: boolean;
    Downside_Tasuki_Gap?: boolean;
    Dragonfly_Doji?: boolean;
    Engulfing?: boolean;
    Evening_Doji_Star?: boolean;
    Evening_Star?: boolean;
    Falling_Three_Methods?: boolean;
    Falling_Window?: boolean;
    Gravestone_Doji?: boolean;
    Hammer?: boolean;
    Hanging_Man?: boolean;
    Harami_Cross?: boolean;
    Harami?: boolean;
    Inverted_Hammer?: boolean;
    Kicking?: boolean;
    Long_Lower_Shadow?: boolean;
    Long_Upper_Shadow?: boolean;
    Marubozu_Black?: boolean;
    Marubozu_White?: boolean;
    Morning_Doji_Star?: boolean;
    Morning_Star?: boolean;
    On_Neck?: boolean;
    Piercing?: boolean;
    Rising_Three_Methods?: boolean;
    Rising_Window?: boolean;
    Shooting_Star?: boolean;
    Spinning_Top_Black?: boolean;
    Spinning_Top_White?: boolean;
    Three_Black_Crows?: boolean;
    Three_White_Soldiers?: boolean;
    TriStar?: boolean;
    Tweezer_Bottom?: boolean;
    Tweezer_Top?: boolean;
    Upside_Tasuki_Gap?: boolean;
  };
  Bandwidth?: number;
  mult?: number;
  Source?: 'close' | 'High/Low' | 'Close/Open';
  Repainting_Smoothing?: boolean;
  Pivot_Period?: number;
  Maximum_Number_of_Pivot?: number;
  Maximum_Channel_Width_?: number;
  Maximum_Number_of_SR?: number;
  Minimum_Strength?: number;
  Label_Location?: number;
  Line_Style?: 'Solid' | 'Dashed' | 'Dotted';
  Line_Width?: number;
  Show_Point_Points?: boolean;
  Pivot_High?: number;
  Pivot_Low?: number;
  Type?: 'Traditional' | 'Fibonacci' | 'Woodie' | 'Classic' | 'DM' | 'Camarilla';
  Pivots_Timeframe?: 'Auto' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Biyearly' | 'Triyearly' | 'Quinquennially' | 'Decennially';
  Number_of_Pivots_Back?: number;
  Use_Dailybased_Values?: boolean;
}

@Injectable()
export class IndicatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndicatorService.name);
  private indicatorSettings: { [key: string]: IndicatorSettings } = {};
  private emissionSettings: { [key: string]: { enabledIndicators: string[]; enabledTimeframes: string[] } } = {};
  private indicatorList: string[] = [
    'EMA50', 
    'EMA200', 
    'RSI', 
    'MACD',
    'FibonacciBollingerBands', 
    'VWAP', 
    'BollingerBands', 
    'CandlestickPatterns',
    'Nadaraya-Watson-LuxAlgo',
    'SRv2',
    'Pivot Points High Low',
    'Pivot Points Standard',
  ];
 private symbols: string[] = [
    'VANTAGE:XAUUSD',
    'VANTAGE:GER40',
    'VANTAGE:NAS100',
    'BINANCE:BTCUSDT'
  ];
  private timeframes: string[] = [
    '15',
    '60',
    '240',
    '1D',
    '1W'
  ];
  private readonly tvCredentials: { [symbol: string]: { session: string; signature: string } } = {
    'VANTAGE:XAUUSD': { session: 'ah812nch1fjn50wh93nacny1nk286eyc', signature: 'v3:BVWFN51Qcwln48iw3Uz0WbWkxmiX2SbmbheoFmCruiE=' },
    'VANTAGE:GER40': { session: 's1ycepfkikx69v3dvifi1hzld2gxu4bn', signature: 'v3:uOHIyCVOqUJFYtZ6LoV+j20uGJEE0eOuJoYSZ0eMU6k=' },
    'VANTAGE:NAS100': { session: '1kw9xc2ckwvfjm46n022jjwj82wvkai0', signature: 'v3:NZqDSi4EqlcEM3AaK0McWdhtpeYRVhEM+m+XJgL30/M=' },
    'BINANCE:BTCUSDT': { session: 'c7bpt5jh7ohx5yrbjt8c5mxxfpjd3rnx', signature: 'v3:AMeke7FM58qjON6a6gIbhCZu5t1oSCPYyJ3XplXfaZk=' }
  };
  private readonly defaultSettings: IndicatorSettings[] = [
    { indicator: 'EMA50', period: 50, source: 'close', offset: 0, maType: 'EMA' },
    { indicator: 'EMA200', period: 200, source: 'close', offset: 0, maType: 'EMA' },
    { 
      indicator: 'RSI', 
      rsiLength: 14, 
      length: 14, 
      maType: 'SMA', 
      bbStdDev: 2, 
      source: 'close', 
      offset: 0,
      calculateDivergence: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'MACD', 
      macdFastPeriod: 12, 
      macdSlowPeriod: 26, 
      macdSignalPeriod: 9, 
      macdSourceMaType: 'EMA', 
      macdSignalMaType: 'EMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'FibonacciBollingerBands', 
      fibLookback: 200, 
      multiply: 3,
      source: 'hlc3' 
    },
    { 
      indicator: 'VWAP', 
      vwapAnchor: 'Session', 
      vwapBandsMultiplier1: 1, 
      vwapBandsMultiplier2: 2, 
      vwapBandsMultiplier3: 3, 
      source: 'hlc3',
      hideVwapOn1DOrAbove: false,
      bandsCalculationMode: 'Standard Deviation',
      offset: 0,
      band1: true,
      band2: false,
      band3: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'BollingerBands', 
      length: 20, 
      bbStdDev: 2, 
      maType: 'SMA', 
      source: 'close', 
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    { 
      indicator: 'CandlestickPatterns', 
      patternType: 'Both', 
      trendRule: 'SMA50', 
      patternSettings: {
        Abandoned_Baby: true,
        Dark_Cloud_Cover: true,
        Doji: true,
        Doji_Star: true,
        Downside_Tasuki_Gap: true,
        Dragonfly_Doji: true,
        Engulfing: true,
        Evening_Doji_Star: true,
        Evening_Star: true,
        Falling_Three_Methods: true,
        Falling_Window: true,
        Gravestone_Doji: true,
        Hammer: true,
        Hanging_Man: true,
        Harami_Cross: true,
        Harami: true,
        Inverted_Hammer: true,
        Kicking: true,
        Long_Lower_Shadow: true,
        Long_Upper_Shadow: true,
        Marubozu_Black: true,
        Marubozu_White: true,
        Morning_Doji_Star: true,
        Morning_Star: true,
        On_Neck: true,
        Piercing: true,
        Rising_Three_Methods: true,
        Rising_Window: true,
        Shooting_Star: true,
        Spinning_Top_Black: true,
        Spinning_Top_White: true,
        Three_Black_Crows: true,
        Three_White_Soldiers: true,
        TriStar: true,
        Tweezer_Bottom: true,
        Tweezer_Top: true,
        Upside_Tasuki_Gap: true
      },
    },
    {
      indicator: 'Nadaraya-Watson-LuxAlgo',
      Bandwidth: 8,
      mult: 3,
      Source: 'close',
      Repainting_Smoothing: true,
    },
    {
      indicator: 'SRv2',
      Pivot_Period: 10,
      Source: 'High/Low',
      Maximum_Number_of_Pivot: 20,
      Maximum_Channel_Width_: 10,
      Maximum_Number_of_SR: 5,
      Minimum_Strength: 2,
      Label_Location: 20,
      Line_Style: 'Dashed',
      Line_Width: 2,
      Show_Point_Points: false,
    },
    {
      indicator: 'Pivot Points High Low',
      Pivot_High: 10,
      Pivot_Low: 10,
    },
    {
      indicator: 'Pivot Points Standard',
      Type: 'Traditional',
      Pivots_Timeframe: 'Auto',
      Number_of_Pivots_Back: 15,
      Use_Dailybased_Values: true,
    },
  ];
  private tvClients: { [symbol: string]: any } = {};
  private charts: { [key: string]: any } = {};
  private proxyList: string[] = [
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10004',
    'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  ];
  private proxyAssignments: { [symbol: string]: string } = {
    'VANTAGE:XAUUSD': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10001',
    'VANTAGE:GER40': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10002',
    'VANTAGE:NAS100': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10003',
    'BINANCE:BTCUSDT': 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10006'
  };
  private marketPriceProxy: string = 'http://sp3l288a8s:7Rr47cOcogJk1+Lhpw@dc.decodo.com:10005';
  structuredData: any = {};
  lastUpdateTime: number;

  constructor(
    private readonly httpService: HttpService,
    @Inject('SOCKET_SERVICE') private socketService: SocketService,
    @InjectModel('IndicatorSettings') private indicatorSettingsModel: Model<any>,
    @InjectModel('EmissionSettings') private emissionSettingsModel: Model<any>,
  ) {}

  private getProxyForSymbol(symbol: string): string {
    return this.proxyAssignments[symbol] || this.proxyList[0]; // Fallback to first proxy
  }

  async onModuleInit() {
    try {
      this.logger.log(`[${new Date().toISOString()}] Server starting`);
      await this.initializeVantageData();
      await this.initializeTradingView();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Server startup failed: ${error.message}`);
      throw error;
    }
  }

  private async initializeTradingView() {
    try {
      for (const symbol of this.symbols) {
        const creds = this.tvCredentials[symbol];
        if (!creds || !creds.session || !creds.signature) {
          this.logger.error(`Missing TradingView session or signature for ${symbol}`);
          throw new Error(`Missing TradingView session or signature for ${symbol}`);
        }
        const proxyUrl = this.getProxyForSymbol(symbol);
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        this.tvClients[symbol] = new Client({
          token: creds.session,
          signature: creds.signature,
          fetchOptions: {
            agent: proxyAgent,
          },
        });
        
        this.tvClients[symbol].onError((err: Error) => {
          try {
            this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
            this.reinitializeClient(symbol);
          } catch (error) {
            this.logger.error(`Failed during error handling for ${symbol}: ${error.message}`, error.stack);
          }
        });
        this.logger.verbose(`TradingView WS connected for ${symbol} using proxy ${proxyUrl}`);
      }
      await this.setupIndicatorsAndPrice();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] TradingView initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async reinitializeClient(symbol: string) {
    try {
      if (this.tvClients[symbol]) {
        await this.tvClients[symbol].end();
        this.tvClients[symbol] = null;
      }
      const creds = this.tvCredentials[symbol];
      const proxyUrl = this.getProxyForSymbol(symbol);
      const proxyAgent = new HttpsProxyAgent(proxyUrl);
      this.tvClients[symbol] = new Client({
        token: creds.session,
        signature: creds.signature,
        fetchOptions: {
          agent: proxyAgent,
        },
      });
      this.tvClients[symbol].onError((err: Error) => {
        this.logger.error(`TradingView WebSocket error for ${symbol} using proxy ${proxyUrl}: ${err.message}`, err.stack);
        this.reinitializeClient(symbol);
      });
      this.logger.verbose(`TradingView WS reconnected for ${symbol} using proxy ${proxyUrl}`);
      await this.setupIndicatorsAndPrice(symbol);
    } catch (error) {
      this.logger.error(`Failed to reinitialize client for ${symbol}: ${error.message}`);
      setTimeout(() => this.reinitializeClient(symbol), 5000);
    }
  }

  private async initializeVantageData() {
    try {
      const emissionSettings = await this.emissionSettingsModel.find().exec();
      emissionSettings.forEach(settings => {
        this.emissionSettings[settings.symbol] = {
          enabledIndicators: settings.enabledIndicators,
          enabledTimeframes: settings.enabledTimeframes,
        };
      });
      await this.loadIndicatorSettings();
      await this.loadEmissionSettings();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async loadIndicatorSettings() {
    try {
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          for (const defaultSetting of this.defaultSettings) {
            const key = `${symbol}:${timeframe}:${defaultSetting.indicator}`;
            const existingSettings = await this.indicatorSettingsModel
              .findOne({ symbol, timeframe, indicator: defaultSetting.indicator })
              .exec();
            if (existingSettings) {
              this.indicatorSettings[key] = { ...existingSettings.toObject() };
              loadedSettingsCount++;
            } else {
              const newSettings = { symbol, timeframe, symbolTimeframeIndicator: key, ...defaultSetting };
              await this.indicatorSettingsModel
                .findOneAndUpdate(
                  { symbol, timeframe, indicator: defaultSetting.indicator },
                  newSettings,
                  { upsert: true, new: true }
                )
                .exec();
              this.indicatorSettings[key] = { ...defaultSetting };
              this.logger.log(`[${new Date().toISOString()}] Initialized default indicator settings for ${key}`);
            }
          }
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} indicator settings from MongoDB`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load indicator settings: ${error.message}`);
      throw error;
    }
  }

  private async loadEmissionSettings() {
    try {
      const defaultEmissionSettings = {
        enabledIndicators: this.indicatorList,
        enabledTimeframes: this.timeframes,
      };
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        const existingSettings = await this.emissionSettingsModel
          .findOne({ symbol })
          .exec();
        if (existingSettings) {
          this.emissionSettings[symbol] = {
            enabledIndicators: existingSettings.enabledIndicators,
            enabledTimeframes: existingSettings.enabledTimeframes,
          };
          loadedSettingsCount++;
        } else {
          const newSettings = { symbol, ...defaultEmissionSettings };
          await this.emissionSettingsModel
            .findOneAndUpdate({ symbol }, newSettings, { upsert: true, new: true })
            .exec();
          this.emissionSettings[symbol] = { ...defaultEmissionSettings };
          this.logger.log(`[${new Date().toISOString()}] Initialized default emission settings for ${symbol}`);
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} emission settings from MongoDB, initialized ${this.symbols.length - loadedSettingsCount} with defaults`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load emission settings: ${error.message}`);
      throw error;
    }
  }

  async saveIndicatorSettings(settings: IndicatorSettings & { symbol: string; timeframe: string; indicator: string }) {
    try {
      const key = `${settings.symbol}:${settings.timeframe}:${settings.indicator}`;
      await this.indicatorSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol, timeframe: settings.timeframe, indicator: settings.indicator },
          { ...settings, symbolTimeframeIndicator: key },
          { upsert: true, new: true }
        )
        .exec();
      this.indicatorSettings[key] = { ...settings };
      this.logger.log(`[${new Date().toISOString()}] Saved indicator settings for ${key}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Settings saved' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save indicator settings for ${settings.symbol}:${settings.timeframe}:${settings.indicator}: ${error.message}`);
      throw error;
    }
  }

  async saveEmissionSettings(settings: { symbol: string; enabledIndicators: string[]; enabledTimeframes: string[] }) {
    try {
      await this.emissionSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol },
          settings,
          { upsert: true, new: true }
        )
        .exec();
      this.emissionSettings[settings.symbol] = {
        enabledIndicators: settings.enabledIndicators,
        enabledTimeframes: settings.enabledTimeframes,
      };
      this.logger.log(`[${new Date().toISOString()}] Saved emission settings for ${settings.symbol}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Emission settings updated successfully' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save emission settings for ${settings.symbol}: ${error.message}`);
      throw error;
    }
  }

  async getIndicatorSettings(symbol: string, timeframe: string) {
    try {
      const settings = await this.indicatorSettingsModel
        .find({ symbol, timeframe })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched indicator settings for ${symbol}:${timeframe}:`, JSON.stringify(settings, null, 2));
      return settings.length > 0 ? settings : null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch indicator settings for ${symbol}:${timeframe}: ${error.message}`);
      throw error;
    }
  }

  async getEmissionSettings(symbol: string) {
    try {
      const settings = await this.emissionSettingsModel
        .findOne({ symbol })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched emission settings for ${symbol}:`, JSON.stringify(settings, null, 2));
      return settings || null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch emission settings for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  private async setupIndicatorsAndPrice(symbol?: string) {
    const symbolsToSetup = symbol ? [symbol] : this.symbols;
    const indicatorsMap: Record<string, any> = {};
    const tvIndicators = [
      {
        name: 'EMA50',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.period ?? 50,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.maType ?? 'EMA'
        })
      },
      {
        name: 'EMA200',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.period ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.maType ?? 'EMA'
        })
      },
      {
        name: 'RSI',
        id: 'STD;RSI',
        inputs: (settings: IndicatorSettings) => ({
          RSI_Length: settings?.rsiLength ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.rsiLength ?? 14,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.source ?? 'close',
          Calculate_Divergence: settings?.calculateDivergence ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.calculateDivergence ?? false,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.maType ?? 'SMA',
          Length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.length ?? 14,
          BB_StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.bbStdDev ?? 2,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'MACD',
        id: 'STD;MACD',
        inputs: (settings: IndicatorSettings) => ({
          Fast_Length: settings?.macdFastPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdFastPeriod ?? 12,
          Slow_Length: settings?.macdSlowPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSlowPeriod ?? 26,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.source ?? 'close',
          Signal_Smoothing: settings?.macdSignalPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalPeriod ?? 9,
          Oscillator_MA_Type: settings?.macdSourceMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSourceMaType ?? 'EMA',
          Signal_Line_MA_Type: settings?.macdSignalMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalMaType ?? 'EMA',
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'FibonacciBollingerBands',
        id: 'PUB;2835',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.fibLookback ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.fibLookback ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.source ?? 'hlc3',
          mult: settings?.multiply ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.multiply ?? 3
        })
      },
      {
        name: 'VWAP',
        id: 'STD;VWAP',
        inputs: (settings: IndicatorSettings) => ({
          Hide_VWAP_on_1D_or_Above: settings?.hideVwapOn1DOrAbove ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.hideVwapOn1DOrAbove ?? false,
          Anchor_Period: settings?.vwapAnchor ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapAnchor ?? 'Session',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.source ?? 'hlc3',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.offset ?? 0,
          Bands_Calculation_Mode: settings?.bandsCalculationMode ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.bandsCalculationMode ?? 'Standard Deviation',
          band_1: settings?.band1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band1 ?? true,
          Bands_Multiplier_1: settings?.vwapBandsMultiplier1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier1 ?? 1,
          band_2: settings?.band2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band2 ?? false,
          Bands_Multiplier_2: settings?.vwapBandsMultiplier2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier2 ?? 2,
          band_3: settings?.band3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band3 ?? false,
          Bands_Multiplier_3: settings?.vwapBandsMultiplier3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier3 ?? 3,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'BollingerBands',
        id: 'STD;Bollinger_Bands',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.length ?? 20,
          Basis_MA_Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.maType ?? 'SMA',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.source ?? 'close',
          StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.bbStdDev ?? 2,
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.offset ?? 0,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'CandlestickPatterns',
        id: 'STD;Candlestick%1Pattern%1All%1Candlestick%1Patterns',
        inputs: (settings: IndicatorSettings) => ({
          Detect_Trend_Based_On: settings?.trendRule ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.trendRule ?? 'SMA50',
          Pattern_Type: settings?.patternType ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternType ?? 'Both',
          ...settings?.patternSettings ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternSettings,
        })
      },
      {
        name: 'Nadaraya-Watson-LuxAlgo',
        id: 'PUB;6d9015a1d65f4b53acaa7210554c446b',
        inputs: (settings: IndicatorSettings) => ({
          Bandwidth: settings?.Bandwidth ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Bandwidth ?? 8,
          mult: settings?.mult ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.mult ?? 3,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Source ?? 'close',
          Repainting_Smoothing: settings?.Repainting_Smoothing ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Repainting_Smoothing ?? true,
        }),
      },
      {
        name: 'SRv2',
        id: 'PUB;svbUudRasDCWzr86ZxLrL2erJrnv0h1x',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_Period: settings?.Pivot_Period ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Pivot_Period ?? 10,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Source ?? 'High/Low',
          _Maximum_Number_of_Pivot: settings?.Maximum_Number_of_Pivot ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_Pivot ?? 20,
          Maximum_Channel_Width_: settings?.Maximum_Channel_Width_ ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Channel_Width_ ?? 10,
          _Maximum_Number_of_SR: settings?.Maximum_Number_of_SR ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_SR ?? 5,
          _Minimum_Strength: settings?.Minimum_Strength ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Minimum_Strength ?? 2,
          Label_Location: settings?.Label_Location ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Label_Location ?? 20,
        }),
      },
      {
        name: 'Pivot Points High Low',
        id: 'STD;Pivot%1Points%1High%1Low',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_High: settings?.Pivot_High ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_High ?? 10,
          Pivot_Low: settings?.Pivot_Low ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_Low ?? 10,
        }),
      },
      {
        name: 'Pivot Points Standard',
        id: 'STD;Pivot%1Points%1Standard',
        inputs: (settings: IndicatorSettings) => ({
          Type: settings?.Type ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Type ?? 'Traditional',
          Pivots_Timeframe: settings?.Pivots_Timeframe ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Pivots_Timeframe ?? 'Auto',
          Number_of_Pivots_Back: settings?.Number_of_Pivots_Back ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Number_of_Pivots_Back ?? 15,
          Use_Dailybased_Values: settings?.Use_Dailybased_Values ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Use_Dailybased_Values ?? true,
        }),
      },
    ];

    // Separate indicators into two groups
    const mainIndicators = tvIndicators.filter(ind => 
      !['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );
    const specialIndicators = tvIndicators.filter(ind => 
      ['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );

    // Setup main indicators
    await this.fetchMainIndicators(mainIndicators, indicatorsMap, symbolsToSetup);

    // Setup special indicators
    await this.fetchSpecialIndicators(specialIndicators, symbolsToSetup);

    // Setup market price subscriptions
    await this.fetchMarketPrice(symbolsToSetup);
  }

  private async fetchMarketPrice(symbolsToSetup: string[]) {
    // Initialize structuredData at class level if not already initialized
    if (!this.structuredData) {
      this.structuredData = {};
    }

    for (const symbol of symbolsToSetup) {
      // Ensure symbol entry exists in structuredData
      if (!this.structuredData[symbol]) {
        this.structuredData[symbol] = {};
      }

      const creds = this.tvCredentials[symbol];
      if (!creds || !creds.session || !creds.signature) {
        this.logger.error(`Invalid TradingView credentials for ${symbol}`);
        continue;
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      const key = `${symbol}:marketPrice`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe: '1', fetchOptions: { agent: new HttpsProxyAgent(this.marketPriceProxy) } });
      this.charts[key] = chart;

      let lastUpdateTime = Date.now();

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for market price on ${symbol}`);
        const keepAlive = setInterval(() => {
          if (chart.isDeleted) {
            clearInterval(keepAlive);
            return;
          }
          chart.setMarket(symbol, { timeframe: '1' });
          this.logger.debug(`Sent keep-alive for ${symbol} market price chart`);
        }, 30000);
      });

      chart.onUpdate(() => {
    const periods = chart.periods || [];
        const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : {};
        if (!latest || typeof latest.close !== 'number' || isNaN(latest.close) || typeof latest.volume !== 'number' || isNaN(latest.volume) || typeof latest.time !== 'number') {
          this.logger.warn(`Non-numeric market data for ${symbol}: close=${latest?.close}, volume=${latest?.volume}, time=${latest?.time}`);
          return;
        }
        this.structuredData[symbol].marketPrice = latest.close;
        this.structuredData[symbol].volume = latest.volume;
        const priceEmitValues: { [key: string]: any } = { symbol, marketPrice: latest.close, volume: latest.volume };
        this.logger.log(`[${new Date(latest.time * 1000).toISOString()}] Emitting market price and volume for ${symbol}: ${JSON.stringify({ close: latest.close, volume: latest.volume })}`);
        this.socketService.emitLiveDataAll(priceEmitValues);
        this.logger.debug(`Emitted data: ${JSON.stringify(priceEmitValues)}`);
        this.lastUpdateTime = latest.time * 1000;
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for market price on ${symbol}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.fetchMarketPrice([symbol]), 5000);
      });

      const timeout = setInterval(() => {
        if (Date.now() - lastUpdateTime > 1000000) {
          this.logger.warn(`No market price updates for ${symbol} in last 10 seconds, recreating chart`);
          chart.delete();
          delete this.charts[key];
          clearInterval(timeout);
          this.fetchMarketPrice([symbol]);
        }
      }, 5000);
    }
  }

  private async fetchMainIndicators(indicators: any[], indicatorsMap: Record<string, any>, symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    // Initialize structured data
    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }
    }

    // Load indicators
    for (const { name, id, inputs } of indicators) {
      if (!this.indicatorList.includes(name)) continue;

      const proxyAgent = new HttpsProxyAgent(this.proxyList[0]); // Use first proxy for indicator loading
      try {
        indicatorsMap[name] = await getIndicator(id, undefined, { agent: proxyAgent });
      } catch (err) {
        this.logger.error(`Failed to load indicator ${name}: ${err.message}`, err.stack);
        continue;
      }

      for (const symbol of symbolsToSetup) {
        const client = this.tvClients[symbol];
        if (!client) {
          this.logger.error(`No TradingView client for ${symbol}`);
          continue;
        }

        for (const timeframe of this.timeframes) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key];
          try {
            const inputValues = inputs(settings || {});
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicatorsMap[name].setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            continue;
          }

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe });
          const study = new chart.Study(indicatorsMap[name]);
          this.charts[key] = chart;

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
          });

          study.onReady(() => {
            this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
          });

          study.onUpdate(() => {
            const periods = study.periods || [];
            const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
            structuredData[symbol][timeframe][name] = latest;
            this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
            this.emitCombinedData(structuredData);
          });

          study.onError((...err: any[]) => {
            this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
          });

          chart.onError((err: any) => {
            this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
          });
        }
      }
    }
  }

  private async setupMainIndicator(symbol: string, timeframe: string, name: string, id: string, inputs: any, indicatorsMap: Record<string, any>) {
    try {
      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        return;
      }

      if (!indicatorsMap[name]) {
        const proxyAgent = new HttpsProxyAgent(this.proxyList[0]);
        indicatorsMap[name] = await getIndicator(id, undefined, { agent: proxyAgent });
      }

      const key = `${symbol}:${timeframe}:${name}`;
      const settings = this.indicatorSettings[key];
      const inputValues = inputs(settings || {});
      for (const [key, value] of Object.entries(inputValues)) {
        if (value !== undefined && value !== null) {
          indicatorsMap[name].setOption(key, value);
        }
      }

      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe });
      const study = new chart.Study(indicatorsMap[name]);
      this.charts[key] = chart;

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
      });

      study.onReady(() => {
        this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
      });

      study.onUpdate(() => {
        const structuredData: Record<string, any> = {};
        for (const sym of this.symbols) {
          structuredData[sym] = {};
          for (const tf of this.timeframes) {
            structuredData[sym][tf] = {};
          }
        }
        const periods = study.periods || [];
        const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
        structuredData[symbol][timeframe][name] = latest;
        this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
        this.emitCombinedData(structuredData);
      });

      study.onError((...err: any[]) => {
        this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
      });

      chart.onError((err: any) => {
        this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
      });
    } catch (err) {
      this.logger.error(`Failed to setup main indicator ${name} for ${symbol} @ TF ${timeframe}: ${err.message}`);
      setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
    }
  }

  private async fetchSpecialIndicators(indicators: any[], symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      for (const timeframe of this.timeframes) {
        for (const { name, id, inputs } of indicators) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key] || {};
          const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbol));

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe, range: 500 });
          this.charts[key] = chart;

          const indicator = await TradingView.getIndicator(id, undefined, { agent: proxyAgent }).catch((err) => {
            this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            throw err;
          });

          this.logger.log(`Available inputs for ${name} on ${symbol}:${timeframe}:`, JSON.stringify(indicator.inputs, null, 2));

          try {
            const inputValues = inputs(settings);
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicator.setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            chart.delete();
            continue;
          }

          const STD = new chart.Study(indicator);

          STD.onError((...err) => {
            this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
          });

          STD.onReady(() => {
            this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
          });

          STD.onUpdate(() => {
            setTimeout(() => {
              const reverseArrays = (obj: any): any => {
                if (Array.isArray(obj)) {
                  return [...obj].reverse();
                } else if (obj && typeof obj === 'object') {
                  const result: any = {};
                  for (const [key, value] of Object.entries(obj)) {
                    result[key] = reverseArrays(value);
                  }
                  return result;
                }
                return obj;
              };

              let data = STD.graphic ? reverseArrays(STD.graphic) : null;

              if (name === 'SRv2' && data && data.labels) {
                data = { labels: data.labels };
              }

              if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
                data = {
                  lines: data.lines
                    .filter((line: any) => line.y1 != null && line.y2 != null)
                    .slice(-2),
                };
              }

              if (name === 'Pivot Points High Low' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 10),
                };
              }

              if (name === 'Pivot Points Standard' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 11),
                };
              }

              structuredData[symbol][timeframe][name] = data;
              this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
              this.emitCombinedData(structuredData);
            });
          });

          chart.onError((err: Error) => {
            this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
          });

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
          });
        }
      }
    }
  }

  private async setupSpecialIndicator(symbol: string, timeframe: string, name: string, id: string, inputs: any) {
    try {
      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        return;
      }

      const key = `${symbol}:${timeframe}:${name}`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe, range: 500 });
      this.charts[key] = chart;

      const proxyAgent = new HttpsProxyAgent(this.getProxyForSymbol(symbol));
      const indicator = await TradingView.getIndicator(id, undefined, { agent: proxyAgent }).catch((err) => {
        this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
        chart.delete();
        throw err;
      });

      const settings = this.indicatorSettings[key] || {};
      try {
        const inputValues = inputs(settings);
        for (const [key, value] of Object.entries(inputValues)) {
          if (value !== undefined && value !== null) {
            indicator.setOption(key, value);
          }
        }
      } catch (err) {
        this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
        chart.delete();
        return;
      }

      const STD = new chart.Study(indicator);

      STD.onError((...err) => {
        this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
      });

      STD.onReady(() => {
        this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
      });

      STD.onUpdate(() => {
        const structuredData: Record<string, any> = {};
        for (const sym of this.symbols) {
          structuredData[sym] = {};
          for (const tf of this.timeframes) {
            structuredData[sym][tf] = {};
          }
        }
        setTimeout(() => {
          const reverseArrays = (obj: any): any => {
            if (Array.isArray(obj)) {
              return [...obj].reverse();
            } else if (obj && typeof obj === 'object') {
              const result: any = {};
              for (const [key, value] of Object.entries(obj)) {
                result[key] = reverseArrays(value);
              }
              return result;
            }
            return obj;
          };

          let data = STD.graphic ? reverseArrays(STD.graphic) : null;

          if (name === 'SRv2' && data && data.labels) {
            data = { labels: data.labels };
          }

          if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
            data = {
              lines: data.lines
                .filter((line: any) => line.y1 != null && line.y2 != null)
                .slice(-2),
            };
          }

          if (name === 'Pivot Points High Low' && data && data.labels) {
            data = {
              labels: data.labels
                .filter((label: any) => label.y != null)
                .sort((a: any, b: any) => b.id - a.id)
                .slice(0, 10),
            };
          }

          if (name === 'Pivot Points Standard' && data && data.labels) {
            data = {
              labels: data.labels
                .filter((label: any) => label.y != null)
                .sort((a: any, b: any) => b.id - a.id)
                .slice(0, 11),
            };
          }

          structuredData[symbol][timeframe][name] = data;
          this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
          this.emitCombinedData(structuredData);
        });
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
      });

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
      });
    } catch (err) {
      this.logger.error(`Failed to setup special indicator ${name} for ${symbol} @ TF ${timeframe}: ${err.message}`);
      setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
    }
  }

  private async emitCombinedData(indicatorData: Record<string, any>) {
    try {
      const combinedData: Record<string, any> = {};
      for (const symbol of this.symbols) {
        combinedData[symbol] = indicatorData[symbol] || {};
        for (const timeframe of this.timeframes) {
          combinedData[symbol][timeframe] = combinedData[symbol][timeframe] || {};
        }
      }
      await this.calculateAndEmitIndicators(combinedData);
    } catch (error) {
      this.logger.error(`Error emitting combined data: ${error.message}`, error.stack);
    }
  }

  async calculateAndEmitIndicators(data: Record<string, any>): Promise<void> {
    try {
      for (const symbol of this.symbols) {
        const enabledTimeframes = this.emissionSettings[symbol]?.enabledTimeframes || this.timeframes;
        const enabledIndicators = this.emissionSettings[symbol]?.enabledIndicators || this.indicatorList;

        for (const timeframe of enabledTimeframes) {
          const emitValues: { [key: string]: any } = { symbol, timeframe };

          for (const indicator of enabledIndicators) {
            const key = `${symbol}:${timeframe}:${indicator}`;
            if (data[symbol] && data[symbol][timeframe] && data[symbol][timeframe][indicator]) {
              const indicatorValue = data[symbol][timeframe][indicator];
              if (!this.isInvalidResult(indicatorValue)) {
                emitValues[indicator] = indicatorValue;
              }
            }
          }

          if (Object.keys(emitValues).length > 2) {
            this.socketService.emitLiveDataAll(emitValues);
          } else {
            this.logger.warn(`[${new Date().toISOString()}] No valid data to emit for ${symbol}:${timeframe}`);
          }
        }

        if (data[symbol] && data[symbol].marketPrice) {
          const priceEmitValues: { [key: string]: any } = { symbol };
          const priceValue = data[symbol].marketPrice;
          if (!this.isInvalidResult(priceValue)) {
            priceEmitValues['marketPrice'] = priceValue;
            priceEmitValues['volume'] = data[symbol].volume;
            this.logger.log(`[${new Date().toISOString()}] Emitting market price for ${symbol}:`, JSON.stringify(priceEmitValues, null, 2));
            this.socketService.emitLiveDataAll(priceEmitValues);
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to calculate and emit indicators: ${error.message}`);
    }
  }

  private isInvalidResult(result: any): boolean {
    if (result === null || result === undefined) return true;
    if (Array.isArray(result) && result.length === 0) return true;
    if (typeof result === 'object') {
      return Object.values(result).every(
        value =>
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && (value === 'N/A' || value === '0.00000'))
      );
    }
    return false;
  }

  async onModuleDestroy() {
    try {
      for (const symbol in this.tvClients) {
        if (this.tvClients[symbol]) {
          await this.tvClients[symbol].end();
          this.logger.verbose(`TradingView WS closed for ${symbol}`);
        }
      }
      for (const key in this.charts) {
        this.charts[key].delete();
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup resources: ${error.message}`);
    }
  }
}
*/

/*
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SocketService } from 'src/common/websocket/socket.service';
import * as TradingViewModule from '@mathieuc/tradingview';
import * as TradingView from '@mathieuc/tradingview';

const { Client, getIndicator } = TradingViewModule;

interface IndicatorSettings {
  indicator: 'EMA50' | 'EMA200' | 'RSI' | 'MACD' | 'FibonacciBollingerBands' | 'VWAP' | 'BollingerBands' | 'CandlestickPatterns' | 'Nadaraya-Watson-LuxAlgo' | 'SRv2' | 'Pivot Points High Low' | 'Pivot Points Standard';
  period?: number;
  source?: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4';
  offset?: number;
  latestValue?: number;
  length?: number;
  bbStdDev?: number;
  rsiLength?: number;
  maType?: 'None' | 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  macdFastPeriod?: number;
  macdSlowPeriod?: number;
  macdSignalPeriod?: number;
  macdSourceMaType?: 'SMA' | 'EMA';
  macdSignalMaType?: 'SMA' | 'EMA';
  fibLookback?: number;
  multiply?: number;
  vwapAnchor?: 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';
  vwapBandsMultiplier1?: number;
  vwapBandsMultiplier2?: number;
  vwapBandsMultiplier3?: number;
  hideVwapOn1DOrAbove?: boolean;
  bandsCalculationMode?: 'Standard Deviation' | 'Percentage';
  band1?: boolean;
  band2?: boolean;
  band3?: boolean;
  timeframeInput?: string;
  waitForTimeframeCloses?: boolean;
  calculateDivergence?: boolean;
  patternType?: 'Bullish' | 'Bearish' | 'Both';
  trendRule?: 'SMA50' | 'SMA50, SMA200' | 'No detection';
  patternSettings?: {
    Abandoned_Baby?: boolean;
    Dark_Cloud_Cover?: boolean;
    Doji?: boolean;
    Doji_Star?: boolean;
    Downside_Tasuki_Gap?: boolean;
    Dragonfly_Doji?: boolean;
    Engulfing?: boolean;
    Evening_Doji_Star?: boolean;
    Evening_Star?: boolean;
    Falling_Three_Methods?: boolean;
    Falling_Window?: boolean;
    Gravestone_Doji?: boolean;
    Hammer?: boolean;
    Hanging_Man?: boolean;
    Harami_Cross?: boolean;
    Harami?: boolean;
    Inverted_Hammer?: boolean;
    Kicking?: boolean;
    Long_Lower_Shadow?: boolean;
    Long_Upper_Shadow?: boolean;
    Marubozu_Black?: boolean;
    Marubozu_White?: boolean;
    Morning_Doji_Star?: boolean;
    Morning_Star?: boolean;
    On_Neck?: boolean;
    Piercing?: boolean;
    Rising_Three_Methods?: boolean;
    Rising_Window?: boolean;
    Shooting_Star?: boolean;
    Spinning_Top_Black?: boolean;
    Spinning_Top_White?: boolean;
    Three_Black_Crows?: boolean;
    Three_White_Soldiers?: boolean;
    TriStar?: boolean;
    Tweezer_Bottom?: boolean;
    Tweezer_Top?: boolean;
    Upside_Tasuki_Gap?: boolean;
  };
  Bandwidth?: number;
  mult?: number;
  Source?: 'close' | 'High/Low' | 'Close/Open';
  Repainting_Smoothing?: boolean;
  Pivot_Period?: number;
  Maximum_Number_of_Pivot?: number;
  Maximum_Channel_Width_?: number;
  Maximum_Number_of_SR?: number;
  Minimum_Strength?: number;
  Label_Location?: number;
  Line_Style?: 'Solid' | 'Dashed' | 'Dotted';
  Line_Width?: number;
  Show_Point_Points?: boolean;
  Pivot_High?: number;
  Pivot_Low?: number;
  Type?: 'Traditional' | 'Fibonacci' | 'Woodie' | 'Classic' | 'DM' | 'Camarilla';
  Pivots_Timeframe?: 'Auto' | 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Biyearly' | 'Triyearly' | 'Quinquennially' | 'Decennially';
  Number_of_Pivots_Back?: number;
  Use_Dailybased_Values?: boolean;
}

@Injectable()
export class IndicatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndicatorService.name);
  private indicatorSettings: { [key: string]: IndicatorSettings } = {};
  private emissionSettings: { [key: string]: { enabledIndicators: string[]; enabledTimeframes: string[] } } = {};
  private indicatorList: string[] = [
    'EMA50', 'EMA200', 'RSI', 'MACD', 'FibonacciBollingerBands', 'VWAP', 'BollingerBands', 'CandlestickPatterns',
    'Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard',
  ];

   private symbols: string[] = ['BINANCE:BTCUSDT','VANTAGE:NAS100', 'VANTAGE:XAUUSD',
   'VANTAGE:GER40',];
  private timeframes: string[] = ['15', '60', '240', '1D', '1W'];
  private readonly tvCredentials: { [symbol: string]: { session: string; signature: string } } = {
    'BINANCE:BTCUSDT': { session: 'c7bpt5jh7ohx5yrbjt8c5mxxfpjd3rnx', signature: 'v3:BVWFN51Qcwln48iw3Uz0WbWkxmiX2SbmbheoFmCruiE=' },
    'VANTAGE:NAS100': { session: '1kw9xc2ckwvfjm46n022jjwj82wvkai0', signature: 'v3:NZqDSi4EqlcEM3AaK0McWdhtpeYRVhEM+m+XJgL30/M=' },
   'VANTAGE:GER40': { session: 's1ycepfkikx69v3dvifi1hzld2gxu4bn', signature: 'v3:uOHIyCVOqUJFYtZ6LoV+j20uGJEE0eOuJoYSZ0eMU6k=' },
  'VANTAGE:XAUUSD': { session: 'ah812nch1fjn50wh93nacny1nk286eyc', signature: 'v3:BVWFN51Qcwln48iw3Uz0WbWkxmiX2SbmbheoFmCruiE=' }
  };
 
  private readonly defaultSettings: IndicatorSettings[] = [
    { indicator: 'EMA50', period: 50, source: 'close', offset: 0, maType: 'EMA' },
    { indicator: 'EMA200', period: 200, source: 'close', offset: 0, maType: 'EMA' },
    {
      indicator: 'RSI',
      rsiLength: 14,
      length: 14,
      maType: 'SMA',
      bbStdDev: 2,
      source: 'close',
      offset: 0,
      calculateDivergence: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    {
      indicator: 'MACD',
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      macdSignalPeriod: 9,
      macdSourceMaType: 'EMA',
      macdSignalMaType: 'EMA',
      source: 'close',
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    {
      indicator: 'FibonacciBollingerBands',
      fibLookback: 200,
      multiply: 3,
      source: 'hlc3'
    },
    {
      indicator: 'VWAP',
      vwapAnchor: 'Session',
      vwapBandsMultiplier1: 1,
      vwapBandsMultiplier2: 2,
      vwapBandsMultiplier3: 3,
      source: 'hlc3',
      hideVwapOn1DOrAbove: false,
      bandsCalculationMode: 'Standard Deviation',
      offset: 0,
      band1: true,
      band2: false,
      band3: false,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    {
      indicator: 'BollingerBands',
      length: 20,
      bbStdDev: 2,
      maType: 'SMA',
      source: 'close',
      offset: 0,
      timeframeInput: '',
      waitForTimeframeCloses: true
    },
    {
      indicator: 'CandlestickPatterns',
      patternType: 'Both',
      trendRule: 'SMA50',
      patternSettings: {
        Abandoned_Baby: true,
        Dark_Cloud_Cover: true,
        Doji: true,
        Doji_Star: true,
        Downside_Tasuki_Gap: true,
        Dragonfly_Doji: true,
        Engulfing: true,
        Evening_Doji_Star: true,
        Evening_Star: true,
        Falling_Three_Methods: true,
        Falling_Window: true,
        Gravestone_Doji: true,
        Hammer: true,
        Hanging_Man: true,
        Harami_Cross: true,
        Harami: true,
        Inverted_Hammer: true,
        Kicking: true,
        Long_Lower_Shadow: true,
        Long_Upper_Shadow: true,
        Marubozu_Black: true,
        Marubozu_White: true,
        Morning_Doji_Star: true,
        Morning_Star: true,
        On_Neck: true,
        Piercing: true,
        Rising_Three_Methods: true,
        Rising_Window: true,
        Shooting_Star: true,
        Spinning_Top_Black: true,
        Spinning_Top_White: true,
        Three_Black_Crows: true,
        Three_White_Soldiers: true,
        TriStar: true,
        Tweezer_Bottom: true,
        Tweezer_Top: true,
        Upside_Tasuki_Gap: true
      },
    },
    {
      indicator: 'Nadaraya-Watson-LuxAlgo',
      Bandwidth: 8,
      mult: 3,
      Source: 'close',
      Repainting_Smoothing: true,
    },
    {
      indicator: 'SRv2',
      Pivot_Period: 10,
      Source: 'High/Low',
      Maximum_Number_of_Pivot: 20,
      Maximum_Channel_Width_: 10,
      Maximum_Number_of_SR: 5,
      Minimum_Strength: 2,
      Label_Location: 20,
      Line_Style: 'Dashed',
      Line_Width: 2,
      Show_Point_Points: false,
    },
    {
      indicator: 'Pivot Points High Low',
      Pivot_High: 10,
      Pivot_Low: 10,
    },
    {
      indicator: 'Pivot Points Standard',
      Type: 'Traditional',
      Pivots_Timeframe: 'Auto',
      Number_of_Pivots_Back: 15,
      Use_Dailybased_Values: true,
    },
  ];
  private tvClients: { [symbol: string]: any } = {};
  private charts: { [key: string]: any } = {};

  constructor(
    private readonly httpService: HttpService,
    @Inject('SOCKET_SERVICE') private socketService: SocketService,
    @InjectModel('IndicatorSettings') private indicatorSettingsModel: Model<any>,
    @InjectModel('EmissionSettings') private emissionSettingsModel: Model<any>,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log(`[${new Date().toISOString()}] Server starting`);
      await this.initializeVantageData();
      await this.initializeTradingView();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Server startup failed: ${error.message}`);
      throw error;
    }
  }

  private async initializeTradingView() {
    try {
      for (const symbol of this.symbols) {
        const creds = this.tvCredentials[symbol];
        if (!creds || !creds.session || !creds.signature) {
          this.logger.error(`Missing TradingView session or signature for ${symbol}`);
          throw new Error(`Missing TradingView session or signature for ${symbol}`);
        }
        this.tvClients[symbol] = new Client({ token: creds.session, signature: creds.signature });

        this.tvClients[symbol].onError((err: Error) => {
          try {
            this.logger.error(`TradingView WebSocket error for ${symbol}: ${err.message}`, err.stack);
            this.reinitializeClient(symbol);
          } catch (error) {
            this.logger.error(`Failed during error handling for ${symbol}: ${error.message}`, error.stack);
          }
        });
        this.logger.verbose(`TradingView WS connected for ${symbol}`);
      }

      // Initialize indicators and market price subscriptions
      await this.setupIndicatorsAndPrice();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] TradingView initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async reinitializeClient(symbol: string) {
    try {
      if (this.tvClients[symbol]) {
        await this.tvClients[symbol].end();
        this.tvClients[symbol] = null;
      }
      const creds = this.tvCredentials[symbol];
      this.tvClients[symbol] = new Client({ token: creds.session, signature: creds.signature });
      this.tvClients[symbol].onError((err: Error) => {
        this.logger.error(`TradingView WebSocket error for ${symbol}: ${err.message}`, err.stack);
        this.reinitializeClient(symbol);
      });
      this.logger.verbose(`TradingView WS reconnected for ${symbol}`);
      // Re-setup indicators for this symbol
      await this.setupIndicatorsAndPrice(symbol);
    } catch (error) {
      this.logger.error(`Failed to reinitialize client for ${symbol}: ${error.message}`);
      setTimeout(() => this.reinitializeClient(symbol), 5000);
    }
  }

  private async initializeVantageData() {
    try {
      const emissionSettings = await this.emissionSettingsModel.find().exec();
      emissionSettings.forEach(settings => {
        this.emissionSettings[settings.symbol] = {
          enabledIndicators: settings.enabledIndicators,
          enabledTimeframes: settings.enabledTimeframes,
        };
      });
      await this.loadIndicatorSettings();
      await this.loadEmissionSettings();
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async loadIndicatorSettings() {
    try {
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        for (const timeframe of this.timeframes) {
          for (const defaultSetting of this.defaultSettings) {
            const key = `${symbol}:${timeframe}:${defaultSetting.indicator}`;
            const existingSettings = await this.indicatorSettingsModel
              .findOne({ symbol, timeframe, indicator: defaultSetting.indicator })
              .exec();
            if (existingSettings) {
              this.indicatorSettings[key] = { ...existingSettings.toObject() };
              loadedSettingsCount++;
            } else {
              const newSettings = { symbol, timeframe, symbolTimeframeIndicator: key, ...defaultSetting };
              await this.indicatorSettingsModel
                .findOneAndUpdate(
                  { symbol, timeframe, indicator: defaultSetting.indicator },
                  newSettings,
                  { upsert: true, new: true }
                )
                .exec();
              this.indicatorSettings[key] = { ...defaultSetting };
              this.logger.log(`[${new Date().toISOString()}] Initialized default indicator settings for ${key}`);
            }
          }
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} indicator settings from MongoDB`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load indicator settings: ${error.message}`);
      throw error;
    }
  }

  private async loadEmissionSettings() {
    try {
      const defaultEmissionSettings = {
        enabledIndicators: this.indicatorList,
        enabledTimeframes: this.timeframes,
      };
      let loadedSettingsCount = 0;
      for (const symbol of this.symbols) {
        const existingSettings = await this.emissionSettingsModel
          .findOne({ symbol })
          .exec();
        if (existingSettings) {
          this.emissionSettings[symbol] = {
            enabledIndicators: existingSettings.enabledIndicators,
            enabledTimeframes: existingSettings.enabledTimeframes,
          };
          loadedSettingsCount++;
        } else {
          const newSettings = { symbol, ...defaultEmissionSettings };
          await this.emissionSettingsModel
            .findOneAndUpdate({ symbol }, newSettings, { upsert: true, new: true })
            .exec();
          this.emissionSettings[symbol] = { ...defaultEmissionSettings };
          this.logger.log(`[${new Date().toISOString()}] Initialized default emission settings for ${symbol}`);
        }
      }
      this.logger.log(`[${new Date().toISOString()}] Loaded ${loadedSettingsCount} emission settings from MongoDB, initialized ${this.symbols.length - loadedSettingsCount} with defaults`);
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to load emission settings: ${error.message}`);
      throw error;
    }
  }

  async saveIndicatorSettings(settings: IndicatorSettings & { symbol: string; timeframe: string; indicator: string }) {
    try {
      const key = `${settings.symbol}:${settings.timeframe}:${settings.indicator}`;
      await this.indicatorSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol, timeframe: settings.timeframe, indicator: settings.indicator },
          { ...settings, symbolTimeframeIndicator: key },
          { upsert: true, new: true }
        )
        .exec();
      this.indicatorSettings[key] = { ...settings };
      this.logger.log(`[${new Date().toISOString()}] Saved indicator settings for ${key}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Settings saved' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save indicator settings for ${settings.symbol}:${settings.timeframe}:${settings.indicator}: ${error.message}`);
      throw error;
    }
  }

  async saveEmissionSettings(settings: { symbol: string; enabledIndicators: string[]; enabledTimeframes: string[] }) {
    try {
      await this.emissionSettingsModel
        .findOneAndUpdate(
          { symbol: settings.symbol },
          settings,
          { upsert: true, new: true }
        )
        .exec();
      this.emissionSettings[settings.symbol] = {
        enabledIndicators: settings.enabledIndicators,
        enabledTimeframes: settings.enabledTimeframes,
      };
      this.logger.log(`[${new Date().toISOString()}] Saved emission settings for ${settings.symbol}:`, JSON.stringify(settings, null, 2));
      return { success: true, message: 'Emission settings updated successfully' };
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to save emission settings for ${settings.symbol}: ${error.message}`);
      throw error;
    }
  }

  async getIndicatorSettings(symbol: string, timeframe: string) {
    try {
      const settings = await this.indicatorSettingsModel
        .find({ symbol, timeframe })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched indicator settings for ${symbol}:${timeframe}:`, JSON.stringify(settings, null, 2));
      return settings.length > 0 ? settings : null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch indicator settings for ${symbol}:${timeframe}: ${error.message}`);
      throw error;
    }
  }

  async getEmissionSettings(symbol: string) {
    try {
      const settings = await this.emissionSettingsModel
        .findOne({ symbol })
        .exec();
      this.logger.log(`[${new Date().toISOString()}] Fetched emission settings for ${symbol}:`, JSON.stringify(settings, null, 2));
      return settings || null;
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to fetch emission settings for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  private async setupIndicatorsAndPrice(symbol?: string) {
    const symbolsToSetup = symbol ? [symbol] : this.symbols;
    const indicatorsMap: Record<string, any> = {};
    const tvIndicators = [
      {
        name: 'EMA50',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.period ?? 50,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA50')?.maType ?? 'EMA'
        })
      },
      {
        name: 'EMA200',
        id: 'STD;EMA',
        inputs: (settings: IndicatorSettings) => ({
          Length: settings?.period ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.period ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.source ?? 'close',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.offset ?? 0,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'EMA200')?.maType ?? 'EMA'
        })
      },
      {
        name: 'RSI',
        id: 'STD;RSI',
        inputs: (settings: IndicatorSettings) => ({
          RSI_Length: settings?.rsiLength ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.rsiLength ?? 14,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.source ?? 'close',
          Calculate_Divergence: settings?.calculateDivergence ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.calculateDivergence ?? false,
          Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.maType ?? 'SMA',
          Length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.length ?? 14,
          BB_StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.bbStdDev ?? 2,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'RSI')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'MACD',
        id: 'STD;MACD',
        inputs: (settings: IndicatorSettings) => ({
          Fast_Length: settings?.macdFastPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdFastPeriod ?? 12,
          Slow_Length: settings?.macdSlowPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSlowPeriod ?? 26,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.source ?? 'close',
          Signal_Smoothing: settings?.macdSignalPeriod ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalPeriod ?? 9,
          Oscillator_MA_Type: settings?.macdSourceMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSourceMaType ?? 'EMA',
          Signal_Line_MA_Type: settings?.macdSignalMaType ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.macdSignalMaType ?? 'EMA',
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'MACD')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'FibonacciBollingerBands',
        id: 'PUB;2835',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.fibLookback ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.fibLookback ?? 200,
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.source ?? 'hlc3',
          mult: settings?.multiply ?? this.defaultSettings.find(s => s.indicator === 'FibonacciBollingerBands')?.multiply ?? 3
        })
      },
      {
        name: 'VWAP',
        id: 'STD;VWAP',
        inputs: (settings: IndicatorSettings) => ({
          Hide_VWAP_on_1D_or_Above: settings?.hideVwapOn1DOrAbove ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.hideVwapOn1DOrAbove ?? false,
          Anchor_Period: settings?.vwapAnchor ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapAnchor ?? 'Session',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.source ?? 'hlc3',
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.offset ?? 0,
          Bands_Calculation_Mode: settings?.bandsCalculationMode ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.bandsCalculationMode ?? 'Standard Deviation',
          band_1: settings?.band1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band1 ?? true,
          Bands_Multiplier_1: settings?.vwapBandsMultiplier1 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier1 ?? 1,
          band_2: settings?.band2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band2 ?? false,
          Bands_Multiplier_2: settings?.vwapBandsMultiplier2 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier2 ?? 2,
          band_3: settings?.band3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.band3 ?? false,
          Bands_Multiplier_3: settings?.vwapBandsMultiplier3 ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.vwapBandsMultiplier3 ?? 3,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'VWAP')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'BollingerBands',
        id: 'STD;Bollinger_Bands',
        inputs: (settings: IndicatorSettings) => ({
          length: settings?.length ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.length ?? 20,
          Basis_MA_Type: settings?.maType ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.maType ?? 'SMA',
          Source: settings?.source ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.source ?? 'close',
          StdDev: settings?.bbStdDev ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.bbStdDev ?? 2,
          Offset: settings?.offset ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.offset ?? 0,
          Timeframe: settings?.timeframeInput ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.timeframeInput ?? '',
          Wait_for_timeframe_closes: settings?.waitForTimeframeCloses ?? this.defaultSettings.find(s => s.indicator === 'BollingerBands')?.waitForTimeframeCloses ?? true
        })
      },
      {
        name: 'CandlestickPatterns',
        id: 'STD;Candlestick%1Pattern%1All%1Candlestick%1Patterns',
        inputs: (settings: IndicatorSettings) => ({
          Detect_Trend_Based_On: settings?.trendRule ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.trendRule ?? 'SMA50',
          Pattern_Type: settings?.patternType ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternType ?? 'Both',
          ...settings?.patternSettings ?? this.defaultSettings.find(s => s.indicator === 'CandlestickPatterns')?.patternSettings,
        })
      },
      {
        name: 'Nadaraya-Watson-LuxAlgo',
        id: 'PUB;6d9015a1d65f4b53acaa7210554c446b',
        inputs: (settings: IndicatorSettings) => ({
          Bandwidth: settings?.Bandwidth ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Bandwidth ?? 8,
          mult: settings?.mult ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.mult ?? 3,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Source ?? 'close',
          Repainting_Smoothing: settings?.Repainting_Smoothing ?? this.defaultSettings.find(s => s.indicator === 'Nadaraya-Watson-LuxAlgo')?.Repainting_Smoothing ?? true,
        }),
      },
      {
        name: 'SRv2',
        id: 'PUB;svbUudRasDCWzr86ZxLrL2erJrnv0h1x',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_Period: settings?.Pivot_Period ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Pivot_Period ?? 10,
          Source: settings?.Source ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Source ?? 'High/Low',
          _Maximum_Number_of_Pivot: settings?.Maximum_Number_of_Pivot ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_Pivot ?? 20,
          Maximum_Channel_Width_: settings?.Maximum_Channel_Width_ ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Channel_Width_ ?? 10,
          _Maximum_Number_of_SR: settings?.Maximum_Number_of_SR ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Maximum_Number_of_SR ?? 5,
          _Minimum_Strength: settings?.Minimum_Strength ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Minimum_Strength ?? 2,
          Label_Location: settings?.Label_Location ?? this.defaultSettings.find(s => s.indicator === 'SRv2')?.Label_Location ?? 20,
        }),
      },
      {
        name: 'Pivot Points High Low',
        id: 'STD;Pivot%1Points%1High%1Low',
        inputs: (settings: IndicatorSettings) => ({
          Pivot_High: settings?.Pivot_High ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_High ?? 10,
          Pivot_Low: settings?.Pivot_Low ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points High Low')?.Pivot_Low ?? 10,
        }),
      },
      {
        name: 'Pivot Points Standard',
        id: 'STD;Pivot%1Points%1Standard',
        inputs: (settings: IndicatorSettings) => ({
          Type: settings?.Type ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Type ?? 'Traditional',
          Pivots_Timeframe: settings?.Pivots_Timeframe ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Pivots_Timeframe ?? 'Auto',
          Number_of_Pivots_Back: settings?.Number_of_Pivots_Back ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Number_of_Pivots_Back ?? 15,
          Use_Dailybased_Values: settings?.Use_Dailybased_Values ?? this.defaultSettings.find(s => s.indicator === 'Pivot Points Standard')?.Use_Dailybased_Values ?? true,
        }),
      },
    ];

    // Separate indicators into two groups
    const mainIndicators = tvIndicators.filter(ind =>
      !['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );
    const specialIndicators = tvIndicators.filter(ind =>
      ['Nadaraya-Watson-LuxAlgo', 'SRv2', 'Pivot Points High Low', 'Pivot Points Standard'].includes(ind.name)
    );

    // Setup main indicators
    await this.fetchMainIndicators(mainIndicators, indicatorsMap, symbolsToSetup);

    // Setup special indicators
    await this.fetchSpecialIndicators(specialIndicators, symbolsToSetup);

    // Setup market price subscriptions
    await this.fetchMarketPrice(symbolsToSetup);
  }

  private async fetchMarketPrice(symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      structuredData[symbol] = {};

      const key = `${symbol}:marketPrice`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe: '15' });
      this.charts[key] = chart;

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for market price on ${symbol}`);
      });

      chart.onUpdate(() => {
        const price = chart.periods && chart.periods.length > 0 ? chart.periods[chart.periods.length - 1].close : null;
        structuredData[symbol].marketPrice = price;
        const priceEmitValues: { [key: string]: any } = { symbol };
        if (!this.isInvalidResult(price)) {
          priceEmitValues['marketPrice'] = price;
          this.logger.log(`[${new Date().toISOString()}] Emitting market price for ${symbol}:`, JSON.stringify(priceEmitValues, null, 2));
          this.socketService.emitLiveDataAll(priceEmitValues);
        }
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for market price on ${symbol}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.fetchMarketPrice([symbol]), 5000);
      });
    }
  }

  private async fetchMainIndicators(indicators: any[], indicatorsMap: Record<string, any>, symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    // Initialize structured data
    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }
    }

    // Load indicators
    for (const { name, id, inputs } of indicators) {
      if (!this.indicatorList.includes(name)) continue;

      try {
        indicatorsMap[name] = await getIndicator(id);
      } catch (err) {
        this.logger.error(`Failed to load indicator ${name}: ${err.message}`, err.stack);
        continue;
      }

      for (const symbol of symbolsToSetup) {
        const client = this.tvClients[symbol];
        if (!client) {
          this.logger.error(`No TradingView client for ${symbol}`);
          continue;
        }

        for (const timeframe of this.timeframes) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key];
          try {
            const inputValues = inputs(settings || {});
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicatorsMap[name].setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            continue;
          }

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe });
          const study = new chart.Study(indicatorsMap[name]);
          this.charts[key] = chart;

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
          });

          study.onReady(() => {
            this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
          });

          study.onUpdate(() => {
            const periods = study.periods || [];
            const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
            structuredData[symbol][timeframe][name] = latest;
            this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
            this.emitCombinedData(structuredData);
          });

          study.onError((...err: any[]) => {
            this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
          });

          chart.onError((err: any) => {
            this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
          });
        }
      }
    }
  }

  private async setupMainIndicator(symbol: string, timeframe: string, name: string, id: string, inputs: any, indicatorsMap: Record<string, any>) {
    try {
      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        return;
      }

      if (!indicatorsMap[name]) {
        indicatorsMap[name] = await getIndicator(id);
      }

      const key = `${symbol}:${timeframe}:${name}`;
      const settings = this.indicatorSettings[key];
      const inputValues = inputs(settings || {});
      for (const [key, value] of Object.entries(inputValues)) {
        if (value !== undefined && value !== null) {
          indicatorsMap[name].setOption(key, value);
        }
      }

      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe });
      const study = new chart.Study(indicatorsMap[name]);
      this.charts[key] = chart;

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${symbol} @ TF ${timeframe} [${name}]`);
      });

      study.onReady(() => {
        this.logger.log(`${name} ready for ${symbol} @ TF ${timeframe}`);
      });

      study.onUpdate(() => {
        const structuredData: Record<string, any> = {};
        for (const sym of this.symbols) {
          structuredData[sym] = {};
          for (const tf of this.timeframes) {
            structuredData[sym][tf] = {};
          }
        }
        const periods = study.periods || [];
        const latest = periods.length > 0 ? periods.reduce((max, curr) => (curr.$time > max.$time ? curr : max), periods[0]) : null;
        structuredData[symbol][timeframe][name] = latest;
        this.logger.log(`📈 ${name} updated for ${symbol} @ TF ${timeframe}: ${JSON.stringify(latest)}`);
        this.emitCombinedData(structuredData);
      });

      study.onError((...err: any[]) => {
        this.logger.error(`${name} error for ${symbol} @ TF ${timeframe}: ${err}`);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
      });

      chart.onError((err: any) => {
        this.logger.error(`Chart error for ${symbol} @ TF ${timeframe} [${name}]: ${err.message}`);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
      });
    } catch (err) {
      this.logger.error(`Failed to setup main indicator ${name} for ${symbol} @ TF ${timeframe}: ${err.message}`);
      setTimeout(() => this.setupMainIndicator(symbol, timeframe, name, id, inputs, indicatorsMap), 5000);
    }
  }

  private async fetchSpecialIndicators(indicators: any[], symbolsToSetup: string[]) {
    const structuredData: Record<string, any> = {};

    for (const symbol of symbolsToSetup) {
      structuredData[symbol] = {};
      for (const timeframe of this.timeframes) {
        structuredData[symbol][timeframe] = {};
      }

      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        continue;
      }

      for (const timeframe of this.timeframes) {
        for (const { name, id, inputs } of indicators) {
          const key = `${symbol}:${timeframe}:${name}`;
          const settings = this.indicatorSettings[key] || {};

          const chart = new client.Session.Chart();
          chart.setMarket(symbol, { timeframe, range: 500 });
          this.charts[key] = chart;

          const indicator = await TradingView.getIndicator(id).catch((err) => {
            this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            throw err;
          });

          this.logger.log(`Available inputs for ${name} on ${symbol}:${timeframe}:`, JSON.stringify(indicator.inputs, null, 2));

          try {
            const inputValues = inputs(settings);
            for (const [key, value] of Object.entries(inputValues)) {
              if (value !== undefined && value !== null) {
                indicator.setOption(key, value);
              }
            }
          } catch (err) {
            this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
            chart.delete();
            continue;
          }

          const STD = new chart.Study(indicator);

          STD.onError((...err) => {
            this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
          });

          STD.onReady(() => {
            this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
          });

          STD.onUpdate(() => {
            setTimeout(() => {
              const reverseArrays = (obj: any): any => {
                if (Array.isArray(obj)) {
                  return [...obj].reverse();
                } else if (obj && typeof obj === 'object') {
                  const result: any = {};
                  for (const [key, value] of Object.entries(obj)) {
                    result[key] = reverseArrays(value);
                  }
                  return result;
                }
                return obj;
              };

              let data = STD.graphic ? reverseArrays(STD.graphic) : null;

              if (name === 'SRv2' && data && data.labels) {
                data = { labels: data.labels };
              }

              if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
                data = {
                  lines: data.lines
                    .filter((line: any) => line.y1 != null && line.y2 != null)
                    .slice(-2),
                };
              }

              if (name === 'Pivot Points High Low' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 10),
                };
              }

              if (name === 'Pivot Points Standard' && data && data.labels) {
                data = {
                  labels: data.labels
                    .filter((label: any) => label.y != null)
                    .sort((a: any, b: any) => b.id - a.id)
                    .slice(0, 11),
                };
              }

              structuredData[symbol][timeframe][name] = data;
              this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
              this.emitCombinedData(structuredData);
            });
          });

          chart.onError((err: Error) => {
            this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
            chart.delete();
            delete this.charts[key];
            setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
          });

          chart.onSymbolLoaded(() => {
            this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
          });
        }
      }
    }
  }

  private async setupSpecialIndicator(symbol: string, timeframe: string, name: string, id: string, inputs: any) {
    try {
      const client = this.tvClients[symbol];
      if (!client) {
        this.logger.error(`No TradingView client for ${symbol}`);
        return;
      }

      const key = `${symbol}:${timeframe}:${name}`;
      const chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe, range: 500 });
      this.charts[key] = chart;

      const indicator = await TradingView.getIndicator(id).catch((err) => {
        this.logger.error(`Failed to load indicator ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
        chart.delete();
        throw err;
      });

      const settings = this.indicatorSettings[key] || {};
      try {
        const inputValues = inputs(settings);
        for (const [key, value] of Object.entries(inputValues)) {
          if (value !== undefined && value !== null) {
            indicator.setOption(key, value);
          }
        }
      } catch (err) {
        this.logger.error(`Failed to set inputs for ${name} on ${key}: ${err.message}`, err.stack);
        chart.delete();
        return;
      }

      const STD = new chart.Study(indicator);

      STD.onError((...err) => {
        this.logger.error(`Study error for ${name} on ${symbol}:${timeframe}:`, ...err);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
      });

      STD.onReady(() => {
        this.logger.log(`Indicator ${name} loaded successfully on ${symbol}:${timeframe}`);
      });

      STD.onUpdate(() => {
        const structuredData: Record<string, any> = {};
        for (const sym of this.symbols) {
          structuredData[sym] = {};
          for (const tf of this.timeframes) {
            structuredData[sym][tf] = {};
          }
        }
        setTimeout(() => {
          const reverseArrays = (obj: any): any => {
            if (Array.isArray(obj)) {
              return [...obj].reverse();
            } else if (obj && typeof obj === 'object') {
              const result: any = {};
              for (const [key, value] of Object.entries(obj)) {
                result[key] = reverseArrays(value);
              }
              return result;
            }
            return obj;
          };

          let data = STD.graphic ? reverseArrays(STD.graphic) : null;

          if (name === 'SRv2' && data && data.labels) {
            data = { labels: data.labels };
          }

          if (name === 'Nadaraya-Watson-LuxAlgo' && data && data.lines) {
            data = {
              lines: data.lines
                .filter((line: any) => line.y1 != null && line.y2 != null)
                .slice(-2),
            };
          }

          if (name === 'Pivot Points High Low' && data && data.labels) {
            data = {
              labels: data.labels
                .filter((label: any) => label.y != null)
                .sort((a: any, b: any) => b.id - a.id)
                .slice(0, 10),
            };
          }

          if (name === 'Pivot Points Standard' && data && data.labels) {
            data = {
              labels: data.labels
                .filter((label: any) => label.y != null)
                .sort((a: any, b: any) => b.id - a.id)
                .slice(0, 11),
            };
          }

          structuredData[symbol][timeframe][name] = data;
          this.logger.log(`"${name}" ${symbol} @ TF ${timeframe} updated!`);
          this.emitCombinedData(structuredData);
        });
      });

      chart.onError((err: Error) => {
        this.logger.error(`Chart error for ${name} on ${symbol}:${timeframe}: ${err.message}`, err.stack);
        chart.delete();
        delete this.charts[key];
        setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
      });

      chart.onSymbolLoaded(() => {
        this.logger.log(`Chart loaded for ${name} on ${symbol}:${timeframe}`);
      });
    } catch (err) {
      this.logger.error(`Failed to setup special indicator ${name} for ${symbol} @ TF ${timeframe}: ${err.message}`);
      setTimeout(() => this.setupSpecialIndicator(symbol, timeframe, name, id, inputs), 5000);
    }
  }

  private async emitCombinedData(indicatorData: Record<string, any>) {
    try {
      const combinedData: Record<string, any> = {};
      for (const symbol of this.symbols) {
        combinedData[symbol] = indicatorData[symbol] || {};
        for (const timeframe of this.timeframes) {
          combinedData[symbol][timeframe] = combinedData[symbol][timeframe] || {};
        }
      }
      await this.calculateAndEmitIndicators(combinedData);
    } catch (error) {
      this.logger.error(`Error emitting combined data: ${error.message}`, error.stack);
    }
  }

  async calculateAndEmitIndicators(data: Record<string, any>): Promise<void> {
    try {
      for (const symbol of this.symbols) {
        const enabledTimeframes = this.emissionSettings[symbol]?.enabledTimeframes || this.timeframes;
        const enabledIndicators = this.emissionSettings[symbol]?.enabledIndicators || this.indicatorList;

        for (const timeframe of enabledTimeframes) {
          const emitValues: { [key: string]: any } = { symbol, timeframe };

          for (const indicator of enabledIndicators) {
            const key = `${symbol}:${timeframe}:${indicator}`;
            if (data[symbol] && data[symbol][timeframe] && data[symbol][timeframe][indicator]) {
              const indicatorValue = data[symbol][timeframe][indicator];
              if (!this.isInvalidResult(indicatorValue)) {
                emitValues[indicator] = indicatorValue;
              }
            }
          }

          if (Object.keys(emitValues).length > 2) {
            this.logger.log(`[${new Date().toISOString()}] Emitting indicators for ${symbol}:${timeframe}:`, JSON.stringify(emitValues, null, 2));
            this.socketService.emitLiveDataAll(emitValues);
          } else {
            this.logger.warn(`[${new Date().toISOString()}] No valid data to emit for ${symbol}:${timeframe}`);
          }
        }

        if (data[symbol] && data[symbol].marketPrice) {
          const priceEmitValues: { [key: string]: any } = { symbol };
          const priceValue = data[symbol].marketPrice;
          if (!this.isInvalidResult(priceValue)) {
            priceEmitValues['marketPrice'] = priceValue;
            this.logger.log(`[${new Date().toISOString()}] Emitting market price for ${symbol}:`, JSON.stringify(priceEmitValues, null, 2));
            this.socketService.emitLiveDataAll(priceEmitValues);
          }
        }
      }
    } catch (error) {
      this.logger.error(`[${new Date().toISOString()}] Failed to calculate and emit indicators: ${error.message}`);
    }
  }

  private isInvalidResult(result: any): boolean {
    if (result === null || result === undefined) return true;
    if (Array.isArray(result) && result.length === 0) return true;
    if (typeof result === 'object') {
      return Object.values(result).every(
        value =>
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && (value === 'N/A' || value === '0.00000'))
      );
    }
    return false;
  }

  async onModuleDestroy() {
    try {
      for (const symbol in this.tvClients) {
        if (this.tvClients[symbol]) {
          await this.tvClients[symbol].end();
          this.logger.verbose(`TradingView WS closed for ${symbol}`);
        }
      }
      for (const key in this.charts) {
        this.charts[key].delete();
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup resources: ${error.message}`);
    }
  }
}


*/