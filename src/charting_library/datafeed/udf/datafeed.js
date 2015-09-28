/*
	This class implements interaction with UDF-compatible datafeed.
	Please remember this class is a separate component and may interact to other code through Datafeeds.DatafeedInterface interface functions ONLY

	See UDF protocol reference at
	https://docs.google.com/document/d/1rAigRhQUSLgLCzUAiVBJGAB7uchb-PzFVe0Bl8WTtF0
*/

Datafeeds = {};

Datafeeds.UDFCompatibleDatafeed = function() {

	this._configuration = undefined;

	this._symbolSearch = null;
	this._symbolsStorage = null;

	this._enableLogging = false;
	this._initializationFinished = false;
	this._callbacks = {};

	//Binary.com related variables
	this._feedHandler = new FeedHandler();
	//Initialize supported_resolutions constant
	this._supported_resolutions = [];
	//For minutes
	for (var index = 1; index <= 59; index++) {
		this._supported_resolutions.push("" + index);
	}
	//For hours
	for (var index = 1; index <= 23; index++) {
		this._supported_resolutions.push("" + (index * 60));
	}
	//For days
	this._supported_resolutions.push('D');
	for (var index = 2; index <= 3; index++) {
		this._supported_resolutions.push(index + 'D');
	}

	this._initialize();
};

Datafeeds.UDFCompatibleDatafeed.prototype.defaultConfiguration = function() {
	return {
		supports_search: true,
		supports_group_request: false,
		supported_resolutions: ["1", "3", "5", "15", "30", "45", "60", "120", "180", "240", "D", "2D", "3D"],
		supports_marks: true,
		exchanges: [],
		symbolsTypes: [
			{name : 'Randoms', 	value : 'Random'},
			{name : 'Commodities', 	value : 'Commodities'},
			{name : 'Forex', 	value : 'Forex'},
			{name : 'Stocks', 	value : 'Stocks'},
			{name : 'Indices', 	value : 'Indices'}
		]
	};
};

Datafeeds.UDFCompatibleDatafeed.prototype.on = function (event, callback) {

	if (!this._callbacks.hasOwnProperty(event)) {
		this._callbacks[event] = [];
	}

	this._callbacks[event].push(callback);
	return this;
};

Datafeeds.UDFCompatibleDatafeed.prototype._fireEvent = function(event, argument) {
	if (this._callbacks.hasOwnProperty(event)) {
		var callbacksChain = this._callbacks[event];
		for (var i = 0; i < callbacksChain.length; ++i) {
			callbacksChain[i](argument);
		}
		this._callbacks[event] = [];
	}
};

Datafeeds.UDFCompatibleDatafeed.prototype.onInitialized = function() {
	this._initializationFinished = true;
	this._fireEvent("initialized");
};

Datafeeds.UDFCompatibleDatafeed.prototype._logMessage = function(message) {
	if (this._enableLogging) {
		var now = new Date();
		console.log(now.toLocaleTimeString() + "." + now.getMilliseconds() + "> " + message);
	}
};

Datafeeds.UDFCompatibleDatafeed.prototype._initialize = function() {

	//Trigger market data load
	this._feedHandler._symbolRequestResponseHandler.getSymbolTypeList();

	var that = this;
	$(document).one('marketsLoaded', function() {
		var configurationData = that.defaultConfiguration();
		configurationData.symbolsTypes = [];
		var tempSymbolTypeList = that._feedHandler._symbolRequestResponseHandler.getSymbolTypeList();
		for (var eachSymbolTypeIndex in tempSymbolTypeList) {
			configurationData.symbolsTypes.push({
				name : tempSymbolTypeList[eachSymbolTypeIndex],
				value : tempSymbolTypeList[eachSymbolTypeIndex]
			});
		}
		that._setupWithConfiguration( configurationData );
	});
};

Datafeeds.UDFCompatibleDatafeed.prototype.onReady = function(callback) {

	if (this._configuration) {
		callback(this._configuration);
	}
	else {
		var that = this;
		this.on("configuration_ready", function() {
			callback(that._configuration);
		});
	}
};

Datafeeds.UDFCompatibleDatafeed.prototype._setupWithConfiguration = function(configurationData) {
	this._configuration = configurationData;

	if (!configurationData.exchanges) {
		configurationData.exchanges = [];
	}

	//	@obsolete; remove in 1.5
	var supportedResolutions = configurationData.supported_resolutions || configurationData.supportedResolutions;
	configurationData.supported_resolutions = supportedResolutions;

	//	@obsolete; remove in 1.5
	var symbolsTypes = configurationData.symbols_types || configurationData.symbolsTypes;
	configurationData.symbols_types = symbolsTypes;

	if (!configurationData.supports_search && !configurationData.supports_group_request) {
		throw "Unsupported datafeed configuration. Must either support search, or support group request";
	}

	if (!configurationData.supports_search) {
		this._symbolSearch = new Datafeeds.SymbolSearchComponent(this);
	}

	if (configurationData.supports_group_request) {
		//	this component will call onInitialized() by itself
		this._symbolsStorage = new Datafeeds.SymbolsStorage(this);
	}
	else {
		this.onInitialized();
	}

	this._fireEvent("configuration_ready");
	this._logMessage("Initialized with " + JSON.stringify(configurationData));
};

//	===============================================================================================================================
//	The functions set below is the implementation of JavaScript API.

Datafeeds.UDFCompatibleDatafeed.prototype._symbolMetadata = function(symbolType) {
	var ret = {};
	if (symbolType) {
		//TODO get this from the market data when the WS API is updated with this information
		var pricescale = 10000, minmov = 1,
					//This is forex market hours
					session = '2200-2159:123456';
		if (symbolType == 'Forex') {
			pricescale = 100000;
		} else if (symbolType == 'Random') {
			session = '24x7';
		}
		ret = {
			pricescale : pricescale,
			minmov : minmov,
			session : session
		};
	}
	return ret;
};

Datafeeds.UDFCompatibleDatafeed.prototype.searchSymbolsByName = function(ticker, exchange, type, onResultReadyCallback) {
	var MAX_SEARCH_RESULTS = 30;

	if (!this._configuration) {
		onResultReadyCallback([]);
		return;
	}

	if (this._configuration.supports_search) {

		var that = this;

		function search(typedCharacter) {
			var result = [];
			$.each(that._feedHandler._symbolRequestResponseHandler._markets, function(key, val) {
					$.each(val.submarkets, function(j, l) {
						$.each(l.symbols, function(i, v) {

							if (val.name.indexOf(type) != -1) {
								if (v.symbol.indexOf(typedCharacter) != -1 || v.symbol_display.indexOf(typedCharacter) != -1) {
									result.push({
										"symbol": v.symbol,
										"description": v.symbol_display,
										"type": val.name,
										"exchange": "",
										"full_name": v.symbol,
										"supported_resolutions": that._supported_resolutions
									});
								}
							}

						});
					});
			});
			return result;
		};

		onResultReadyCallback(search(ticker));

	}

};


//	BEWARE: this function does not consider symbol's exchange
Datafeeds.UDFCompatibleDatafeed.prototype.resolveSymbol = function(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {

	var that = this;

	if (!this._initializationFinished) {
		this.on("initialized", function() {
			that.resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback);
		});

		return;
	}

	function onResultReady(data) {
		var postProcessedData = data;
		if (that.postProcessSymbolInfo) {
			postProcessedData = that.postProcessSymbolInfo(postProcessedData);
		}
		onSymbolResolvedCallback(postProcessedData);
	}

	if (!this._configuration.supports_group_request) {

		var found = false;
		$.each(that._feedHandler._symbolRequestResponseHandler._markets, function(key, val) {
				$.each(val.submarkets, function(j, l) {
					$.each(l.symbols, function(i, v) {

						if (v.symbol.indexOf(symbolName) != -1) {

							var symbolMetadata = that._symbolMetadata(val.name),
									pricescale = symbolMetadata.pricescale,
									minmov = symbolMetadata.minmov,
									session = symbolMetadata.session;

							onResultReady({
								"name": v.symbol,
								"timezone": "UTC",
								"has_intraday": true,
								"has_no_volume": true,
								"ticker": v.symbol,
								"description": v.symbol_display,
								"type": val.name,
								"minmov": minmov,
								"pricescale": pricescale,
								"supported_resolutions": that._supported_resolutions,
								"session": session
							});
							found = true;
							return false;
						}

					});
					return !found;
				});
			return !found;
		});

		if (!found) {
			onResolveErrorCallback("unknown_symbol");
		}

	}
	else {
		if (this._initializationFinished) {
			this._symbolsStorage.resolveSymbol(symbolName, onResultReady, onResolveErrorCallback);
		}
		else {
			this.on("initialized", function() {
				that._symbolsStorage.resolveSymbol(symbolName, onResultReady, onResolveErrorCallback);
			});
		}
	}

};


Datafeeds.UDFCompatibleDatafeed.prototype.getBars = function(symbolInfo, resolution, rangeStartDate, rangeEndDate, onDataCallback, onErrorCallback) {
	//The resolution parameter is a useless parameter because it does not contain the actual resolution of the chart
	try {
		$(document).trigger("chart-status-picture-change", ["loading"]);
		this._feedHandler._ohlcRequestResponseHandler.resetTableData(symbolInfo);
		this._feedHandler._ohlcRequestResponseHandler.getBars(symbolInfo, rangeStartDate, rangeEndDate, onDataCallback, onErrorCallback);
	} catch(e) {
		console.log(e);
	}
};

Datafeeds.UDFCompatibleDatafeed.prototype.subscribeBars = function(symbolInfo, resolution, onRealtimeCallback, listenerGUID) {
	this._feedHandler._tickDataRequestResponseHandler.subscribeBars(symbolInfo, onRealtimeCallback, listenerGUID);
};

Datafeeds.UDFCompatibleDatafeed.prototype.unsubscribeBars = function(listenerGUID) {
	this._feedHandler._tickDataRequestResponseHandler.unsubscribeBars(listenerGUID);
};

// Unsed methods - start
Datafeeds.UDFCompatibleDatafeed.prototype.getMarks = function (symbolInfo, rangeStart, rangeEnd, onDataCallback, resolution) {
};

Datafeeds.UDFCompatibleDatafeed.prototype.calculateHistoryDepth = function(resolution, resolutionBack, intervalBack) {
};

Datafeeds.UDFCompatibleDatafeed.prototype.getQuotes = function(symbols, onDataCallback, onErrorCallback) {
	console.log('[DEBUG] This should not be called at all!');
};

Datafeeds.UDFCompatibleDatafeed.prototype.subscribeQuotes = function(symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
};

Datafeeds.UDFCompatibleDatafeed.prototype.unsubscribeQuotes = function(listenerGUID) {
};
//Unsed methods - end

//	==================================================================================================================================================
//	==================================================================================================================================================
//	==================================================================================================================================================

/*
	It's a symbol storage component for ExternalDatafeed. This component can
	  * interact to UDF-compatible datafeed which supports whole group info requesting
	  * do symbol resolving -- return symbol info by its name
*/
Datafeeds.SymbolsStorage = function(datafeed) {
	this._datafeed = datafeed;

	this._symbolsInfo = {};
	this._symbolsList = [];

	this._requestFullSymbolsList();
};

Datafeeds.SymbolsStorage.prototype._requestFullSymbolsList = function() {

	var that = this;
	var datafeed = this._datafeed;

	$.each(that._feedHandler._symbolRequestResponseHandler._markets, function(key, val) {
			$.each(val.submarkets, function(j, l) {
				$.each(l.symbols, function(i, v) {

				var symbolMetadata = datafeed._symbolMetadata(val.symbol),
						pricescale = symbolMetadata.pricescale,
						minmov = symbolMetadata.minmov,
						session = symbolMetadata.session;

				var symbolInfo = {
					//symbol: z.symbol,
					name: v.symbol,
					base_name: v.symbol,
					description: v.symbol_display,
					full_name: v.symbol,
					legs: [v.symbol],
					has_intraday: true,
					has_no_volume: true,
					listed_exchange: [],
					exchange: [""],
					minmov: minmov,
					//pointvalue: 10,
					pricescale: pricescale,
					type: val.name,
					session: session,
					ticker: v.symbol,
					timezone: 'UTC',
					supported_resolutions: that._supported_resolutions,
					has_daily: true,
					//intraday_multipliers: ["1", "5", "15", "30", "60"],
					has_fractional_volume: false,
					has_weekly_and_monthly: true,
					has_empty_bars: false,
					volume_precision: 0
				};

				that._symbolsInfo[v.symbol] = that._symbolsInfo[v.display_name] = symbolInfo;
				that._symbolsList.push(v.symbol);

			});

		});

	});

	this._symbolsList.sort();
	this._datafeed.onInitialized();

};



//	BEWARE: this function does not consider symbol's exchange
Datafeeds.SymbolsStorage.prototype.resolveSymbol = function(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {

	if (!this._symbolsInfo.hasOwnProperty(symbolName)) {
		onResolveErrorCallback("invalid symbol");
	}
	else {
		onSymbolResolvedCallback(this._symbolsInfo[symbolName]);
	}

};


//	==================================================================================================================================================
//	==================================================================================================================================================
//	==================================================================================================================================================

/*
	It's a symbol search component for ExternalDatafeed. This component can do symbol search only.
	This component strongly depends on SymbolsDataStorage and cannot work without it. Maybe, it would be
	better to merge it to SymbolsDataStorage.
*/

Datafeeds.SymbolSearchComponent = function(datafeed) {
	this._datafeed = datafeed;
};

//	searchArgument = { ticker, onResultReadyCallback}
Datafeeds.SymbolSearchComponent.prototype.searchSymbolsByName = function(searchArgument, maxSearchResults) {

	if (!this._datafeed._symbolsStorage) {
		throw "Cannot use local symbol search when no groups information is available";
	}

	var symbolsStorage = this._datafeed._symbolsStorage;

	var results = [];
	var queryIsEmpty = !searchArgument.ticker || searchArgument.ticker.length === 0;

	for (var i = 0; i < symbolsStorage._symbolsList.length; ++i) {
		var symbolName = symbolsStorage._symbolsList[i];
		var item = symbolsStorage._symbolsInfo[symbolName];

		if (searchArgument.type && searchArgument.type.length > 0 && item.type != searchArgument.type) {
			continue;
		}
		// if (searchArgument.exchange && searchArgument.exchange.length > 0 && item.exchange != searchArgument.exchange) {
		// 	continue;
		// }
		if (queryIsEmpty || item.name.indexOf(searchArgument.ticker) === 0) {
			results.push({
				symbol: item.name,
				full_name: item.full_name,
				description: item.description,
				exchange: item.exchange,
				params: [],
				type: item.type,
				ticker: item.name,
				supported_resolutions: this._datafeed._supported_resolutions
			});
		}

		if (results.length >= maxSearchResults) {
			break;
		}
	}

	searchArgument.onResultReadyCallback(results);
}
