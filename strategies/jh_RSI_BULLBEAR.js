/*
	RSI Bull and Bear
	Use different RSI-strategies depending on a longer trend
	3 feb 2017
	
	(CC-BY-SA 4.0) Tommie Hansen
	https://creativecommons.org/licenses/by-sa/4.0/
	
*/

// req's
var log = require ('../core/log.js');
var config = require ('../core/util.js').getConfig();
var i = 0;
// strategy
var strat = {
	
	/* INIT */
	init: function()
	{
		this.name = 'RSI Bull and Bear';
		this.requiredHistory = config.tradingAdvisor.historySize;
		this.resetTrend();		
		
		// debug? set to flase to disable all logging/messages (improves performance)
		this.debug = true;
		
		// performance
		config.backtest.batchSize = 1000; // increase performance
		config.silent = true;
		config.debug = true;
		
		// add indicators
		this.addIndicator('maSlow', 'SMA', this.settings.SMA_long );
		this.addIndicator('maFast', 'SMA', this.settings.SMA_short );
		this.addIndicator('BULL_RSI', 'RSI', { interval: this.settings.BULL_RSI });
		this.addIndicator('BEAR_RSI', 'RSI', { interval: this.settings.BEAR_RSI });

        var customMACDSettings = {
            optInFastPeriod: 10,
            optInSlowPeriod: 21,
            optInSignalPeriod: 9
        }

        // define the indicators we need     //move the settings into >>>macd input length
        this.addTulipIndicator('mymacd', 'macd', customMACDSettings);

		var customSTOCHsettings = {
			optInFastKPeriod : 30,
			optInSlowKPeriod : 4,
			optInSlowDPeriod : 4
		}
		

		// define the indicators we need     //move the settings into >>>rsi input length
		this.addTulipIndicator('mystoch', 'stoch', customSTOCHsettings);

		var customBBANDSsettings = {
			optInTimePeriod : 20,
			optInNbStdDevs : 2
		}
		
		// define the indicators we need     //move the settings into >>>rsi input length
		this.addTulipIndicator('mybbands', 'bbands', customBBANDSsettings);

		
		// debug stuff
		this.startTime = new Date();
		this.stat = {
			bear: { min: 100, max: 0 },
			bull: { min: 100, max: 0 }
		};
		
	}, // init()
	logIndicators: function() {
        // get all indicators
		let ind = this.indicators,
			maSlow = ind.maSlow.result,
			maFast = ind.maFast.result,
			rsiBear = ind.BEAR_RSI.result,
            MACD = this.tulipIndicators.mymacd.result,
			STOCH = this.tulipIndicators.mystoch.result,
			BBANDS = this.tulipIndicators.mybbands.result;

        let output = '\n=== Candle Log info ===\n';
        output += '\tmaSlow:\t\t' + maSlow +'\n';
        output += '\trsiBear:\t' + rsiBear +'\n';
		output += '\tMACD:\t\t' + MACD.macd +' / '+ MACD.macdSignal +' histo: '+ MACD.macdHistogram +'\n';
		output += '\tSTOCH:\t\t' + STOCH.stochK +' (K) - '+ STOCH.stochD +' (D) \n';
		output += '\tBBANDS:\t\t' + BBANDS.bbandsLower +' (Low) - '+ BBANDS.bbandsMiddle +' (Middle) ' + BBANDS.bbandsUpper +' (High) \n';

        log.debug(output);
    },
	
	/* RESET TREND */
	resetTrend: function()
	{
		var trend = {
			duration: 0,
			direction: 'none',
			longPos: false,
		};
	
		this.trend = trend;
	},
	
	/* get lowest/highest for backtest-period */
	lowHigh: function( rsi, type )
	{
		let cur;
		if( type == 'bear' ) {
			cur = this.stat.bear;
			if( rsi < cur.min ) this.stat.bear.min = rsi; // set new
			if( rsi > cur.max ) this.stat.bear.max = rsi;
		}
		else {
			cur = this.stat.bull;
			if( rsi < cur.min ) this.stat.bull.min = rsi; // set new
			if( rsi > cur.max ) this.stat.bull.max = rsi;
		}
	},
	
	
	/* CHECK */
	check: function()
	{
		
		// get all indicators
		let ind = this.indicators,
			maSlow = ind.maSlow.result,
			maFast = ind.maFast.result,
			rsi,
            MACD = this.tulipIndicators.mymacd.result
            ;
			
		// BEAR TREND
		if( maFast < maSlow )
		{
			rsi = ind.BEAR_RSI.result;
			if( rsi > this.settings.BEAR_RSI_high ) this.short();
			else if( rsi < this.settings.BEAR_RSI_low ) this.long();
			
			if(this.debug) this.lowHigh( rsi, 'bear' );
			//log.debug('BEAR-trend');
		}

		// BULL TREND
		else
		{
			rsi = ind.BULL_RSI.result;
			if( rsi > this.settings.BULL_RSI_high ) this.short();
			else if( rsi < this.settings.BULL_RSI_low )  this.long();
			if(this.debug) this.lowHigh( rsi, 'bull' );
			//log.debug('BULL-trend');
		}
	
	}, // check()
	
	
	/* LONG */
	long: function()
	{
		if( this.trend.direction !== 'up' ) // new trend? (only act on new trends)
		{
			this.resetTrend();
			this.trend.direction = 'up';
			this.advice('long');
			//log.debug('go long');
		}
		
		if(this.debug)
		{
			this.trend.duration++;
			log.debug ('Long since', this.trend.duration, 'candle(s)');
            this.logIndicators();
		}
	},
	
	
	/* SHORT */
	short: function()
	{
		// new trend? (else do things)
		if( this.trend.direction !== 'down' )
		{
			this.resetTrend();
			this.trend.direction = 'down';
			this.advice('short');
		}
		
		if(this.debug)
		{
			this.trend.duration++;
			log.debug ('Short since', this.trend.duration, 'candle(s)');
            this.logIndicators();
		}
	},
	
	
	/* END backtest */
	end: function(){
		
		let seconds = ((new Date()- this.startTime)/1000),
			minutes = seconds/60,
			str;
			
		minutes < 1 ? str = seconds + ' seconds' : str = minutes + ' minutes';
		
		log.debug('====================================');
		log.debug('Finished in ' + str);
		log.debug('====================================');
		
		if(this.debug)
		{
			let stat = this.stat;
			log.debug('RSI low/high for period');
			log.debug('BEAR low/high: ' + stat.bear.min + ' / ' + stat.bear.max);
			log.debug('BULL low/high: ' + stat.bull.min + ' / ' + stat.bull.max);
		}

	}
	
};

module.exports = strat;