SymbolRequestResponsehandler = function (feedHandler) {

  this._markets = null;
  this._symbolTypes = null;

  this._currentlyProcessingRequest = false;

  this.fetchSymbolListAndInformation = function() {
    //If the market information has not been loaded yet
    if (!this._markets) {
      //If we are already processing one request now, ignore subsequent requests
      if (!this._currentlyProcessingRequest) {
        //When the WS API is available, change this code to use the API to get exchange and symbol type lists
        if ( feedHandler._webSocketConnection ) {
          this._currentlyProcessingRequest = true;
          if (!feedHandler._isConnectionReady) {
            $(document).one('websocketsConnectionReady', function() {
              feedHandler._webSocketConnection.send(JSON.stringify({"trading_times": "" + new Date().toISOString().slice(0, 10)}));
            });
          } else {
            feedHandler._webSocketConnection.send(JSON.stringify({"trading_times": "" + new Date().toISOString().slice(0, 10)}));
          }
        }
      }
    } else {
      this._currentlyProcessingRequest = false;;
    }
  };

};

SymbolRequestResponsehandler.prototype.getSymbolTypeList = function() {
  this.fetchSymbolListAndInformation();
  return this._symbolTypes;
};

SymbolRequestResponsehandler.prototype.getSymbolList = function() {
  this.fetchSymbolListAndInformation();
  return this.markets;
};

SymbolRequestResponsehandler.prototype.process = function(data) {
  this._markets = [];
  this._symbolTypes = [];

  for (var marketIndex in data.trading_times.markets) {
    var marketFromResponse = data.trading_times.markets[marketIndex];
    this._symbolTypes.push(marketFromResponse.name);
    var market = {
      name : marketFromResponse.name, //Same as symbolType
      submarkets : []
    };

    for (var submarketIndxx in marketFromResponse.submarkets) {
      var submarket = marketFromResponse.submarkets[submarketIndxx];
      var submarketObj = {
        name : submarket.name,
        symbols : []
      };
      for (var eachSymbolIndx in submarket.symbols) {
        var eachSymbol = submarket.symbols[eachSymbolIndx];
        submarketObj.symbols.push({
          symbol : eachSymbol.symbol,
          symbol_display : eachSymbol.name
        });
      }
      market.submarkets.push(submarketObj);
    }

    this._markets.push(market);
  }

  $(document).trigger('marketsLoaded');
  this._currentlyProcessingRequest = false;
};
