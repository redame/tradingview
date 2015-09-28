function FeedHandler(feedHandler) {

  //Initialize all variables here
  this._webSocketConnection = null;
  this._symbolRequestResponseHandler = null;
  this._ohlcRequestResponseHandler = null;
  this._tickDataRequestResponseHandler = null;
  this._isConnectionReady = false;
  this._db = null;
  this._lastTickTime = null;

  this.init();

};

FeedHandler.prototype.close = function() {

  if (this._webSocketConnection) {
    this._webSocketConnection.close();
  }

};

FeedHandler.prototype.init = function() {

  this._webSocketConnection = new ReconnectingWebSocket("wss://www.binary.com/websockets/v2");

  this._db = new loki();
  /*
    {
      //--------------------Start - Used in OHLCRequestResponseHandler --------------------
      barsKeyTableID : <timestamp>,
      key : symbol + actualResolution,
      onErrorCallback_chart : ,
      onDataCallback_chart : ,
      //--------------------End - Used in OHLCRequestResponseHandler ----------------------
      //--------------------Start - Used in TickDataRequestResponseHandler ----------------
      listenerGUID : , //From TradingView
      onRealtimeCallback_chart : ,
      //--------------------End - Used in TickDataRequestResponseHandler ------------------
    }
  */
  this._db.addCollection('bars_key_table');
  /*
    {
      barsKeyTableID : <same as bars_key_table.id>,
      open : ,
      high : ,
      low : ,
      close : ,
      time : ,
      //This field is used to indicate if the bar has been rendered on chart.
      //TradingView does not like when a bar is tried to be re-rendered which has already been rendered on chart
      rendered :
    }
  */
  this._db.addCollection('bars_table');

  this._symbolRequestResponseHandler = new SymbolRequestResponsehandler(this);
  this._ohlcRequestResponseHandler = new OHLCRequestResponseHandler(this);
  this._tickDataRequestResponseHandler = new TickDataRequestResponseHandler(this);
  this._webSocketConnection.debug = false;
  this._webSocketConnection.timeoutInterval = 5400;

  this._webSocketConnection.onopen = function(event) {
    this._isConnectionReady = true;
    $(document).trigger('websocketsConnectionReady');
  };

  this._webSocketConnection.onerror = function(event) {
    this._isConnectionReady = false;
    console.log('WS error!', event);
  };

  var that = this;
  this._webSocketConnection.onmessage = function(event) {
    var data = JSON.parse( event.data );
    console.log('Message type : ', data.msg_type);
    console.log('Message : ', data);
    switch( data.msg_type ) {
      case "trading_times":
        that._symbolRequestResponseHandler.process( data );
        break;
      case "candles":
        console.log(data);
        that._ohlcRequestResponseHandler.process( data );
        break;
      case "tick":
        //console.log(data);
        if (data.tick.error) {
          //This means, there is no real time feed for this instrument
          $(document).trigger("chart-status-picture-change", ["delayed-feed"]);
          that._lastTickTime = null;
        } else {
          if (data.echo_req.tradingview_ticker_id) {
            var tradingview_ticker_id = TradingView.currentlyDisplayedSymbol + TradingView.actualResolution;
            if (tradingview_ticker_id == data.echo_req.tradingview_ticker_id) {
              that._lastTickTime = Date.now();
              $(document).trigger("chart-status-picture-change", ["realtime-feed"]);
              that._tickDataRequestResponseHandler.process( data );
            } else {
              that._webSocketConnection.send(JSON.stringify({"forget" : data.tick.id}))
            }
          }
        }
        break;
    }
  };

  //If the chart is realtime and we have not received tick for past 1 minute, then we are in disconnected mode
  //Subscribe to tick streaming again
  setInterval(function() {

    if (!that._lastTickTime) return;

    var timeElapsedAfterLastTick = Date.now() - that._lastTickTime;
    if (timeElapsedAfterLastTick >= 60000) { //60 seconds
      $(document).trigger("chart-status-picture-change", ["no-connection"]);
      //We will subscribe to tick streaming again
      if (that._tickDataRequestResponseHandler)
      {
        console.log('Resubscribing to tick streaming');
        that._tickDataRequestResponseHandler.reSubscribeToTicks();
      }
    }

  }, 60000);

};
