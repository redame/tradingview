TickDataRequestResponseHandler = function(feedHandler) {

  this.feedHandler = feedHandler;
  this._barsKeyTable = {};
  this._barsTable = {};

  this.init();

};

TickDataRequestResponseHandler.prototype.init = function() {

  this._barsKeyTable = this.feedHandler._db.getCollection('bars_key_table');
  this._barsTable = this.feedHandler._db.getCollection('bars_table');

};

TickDataRequestResponseHandler.prototype.process = function( data ) {

  var tableRow = this._barsKeyTable.findObject({key : data.echo_req.ticks + TradingView.actualResolution});
  if (!tableRow) return;

  var lastBar = this._barsTable.chain().find({barsKeyTableID : tableRow.barsKeyTableID}).simplesort('time', true).limit(1).data();
  if (!lastBar || lastBar.length <= 0) return;
  lastBar = lastBar[0];
  if (lastBar.time < parseInt(data.tick.epoch)) return;

  var price = parseFloat(data.tick.quote);

  if (price > lastBar.high) {
    lastBar.high = price;
  } else if (price < lastBar.low) {
    lastBar.low = price;
  }
  lastBar.close = price;
  lastBar.rendered = false; //Keep it to false because it is always changing bar

  if (tableRow.onRealtimeCallback_chart)
  {
    this._barsTable.update(lastBar);
    tableRow.onRealtimeCallback_chart( {
      time : lastBar.time,
      open : lastBar.open,
      high : lastBar.high,
      low : lastBar.low,
      close : lastBar.close
    });
  }

};

TickDataRequestResponseHandler.prototype.subscribeBars = function(symbolInfo, onRealtimeCallback, listenerGUID) {

  //console.log(listenerGUID);
  var tableRow = this._barsKeyTable.findObject({key : symbolInfo.ticker + TradingView.actualResolution});
  if (!tableRow) return;

  //Check if listenerGUID has already been assigned. If yes, then this method was wrongly called. Return from here
  if (tableRow.listenerGUID) return;

  tableRow.onRealtimeCallback_chart = onRealtimeCallback;
  tableRow.listenerGUID = listenerGUID;

  //Subscribe to real time tick feed
  this.feedHandler._webSocketConnection.send(JSON.stringify(
                                                    {
                                                      "ticks": symbolInfo.ticker,
                                                      "tradingview_ticker_id": symbolInfo.ticker + TradingView.actualResolution
                                                    }));

  //Subscribe to new bars - The first timeOut call is based on time difference between when we executed this and the next bar time
  //That difference might not be same as totalSecondsInABar since we don't know when the user opened the chart
  var lastBar = this._barsTable.chain().find({barsKeyTableID : tableRow.barsKeyTableID}).simplesort('time', true).limit(1).data()[0];
  var suffixAndIntVal = this.feedHandler._ohlcRequestResponseHandler.parseSuffixAndIntValue(),
      totalSecondsInABar = this.feedHandler._ohlcRequestResponseHandler.totalSecondsInABar(suffixAndIntVal.suffix, suffixAndIntVal.intVal),
      nextBarDateInLocal = new Date(lastBar.time + totalSecondsInABar * 1000);
  var dateNow = new Date();
  var that = this;
  console.log('seconds after which setTimeout will be called : ', Math.ceil((nextBarDateInLocal.getTime() - dateNow.getTime()) / 1000));
  console.log('seconds after which setInterval will be called : ', totalSecondsInABar);

  tableRow.timerHandler = setTimeout(function() {
    console.log('Set time out called at : ', new Date());

    function requestBarUpdates() {
      lastBar = that._barsTable.chain().find({barsKeyTableID : tableRow.barsKeyTableID}).simplesort('time', true).limit(1).data();
      if (lastBar && lastBar.length > 0) {
        lastBar = lastBar[0];
        console.log('LastBar : ', lastBar);
        //requests new bars
        that.feedHandler._ohlcRequestResponseHandler.getBars(symbolInfo, lastBar.time/1000, new Date().getTime() / 1000 + totalSecondsInABar, onRealtimeCallback);
      }
    };

    //From now onwards we can have one interval timer to update new bars
    tableRow.timerHandler = setInterval(function() {
      console.log('Set interval called at : ', new Date());
      requestBarUpdates();
    }, totalSecondsInABar * 1000);

    requestBarUpdates();
    that._barsKeyTable.update(tableRow);

  }, Math.ceil(nextBarDateInLocal.getTime() - dateNow.getTime()) + 1000);//Trigger scheduled time + 1s later. Hitting server before 1s is too early to get current bar
  this._barsKeyTable.update(tableRow);

};

TickDataRequestResponseHandler.prototype.unsubscribeBars = function(listenerGUID) {

  var tableRow = this._barsKeyTable.findObject({listenerGUID : listenerGUID});
  if (!tableRow) return;

  //Clear timer to get latest OHLC - At this point, we don't know if it was setTimeout or setInterval
  try {
    clearInterval(tableRow.timerHandler);
  } catch(e) {}
  try {
    clearTimeout(tableRow.timerHandler);
  } catch(e) {}

  /*
    This method is called in following scenarios -
      1. When chart is moved from left to right and charting framework asks for more historical candles
      2. When time period is changed
      3. When symbol is changed
    We cannot clear the entire table. What we can do is, we can just clear these variables(those which are tabbed)
      {
        barsKeyTableID : <timestamp>,
        key : symbol + actualResolution,
                onErrorCallback_chart : ,
                onDataCallback_chart : ,
                listenerGUID : , //From TradingView
                onRealtimeCallback_chart : ,
      }
  */
  tableRow.onErrorCallback_chart = null;
  tableRow.onDataCallback_chart = null;
  tableRow.listenerGUID = null;
  tableRow.onRealtimeCallback_chart = null;
  this._barsKeyTable.update(tableRow);
};

TickDataRequestResponseHandler.prototype.reSubscribeToTicks = function() {

  var tableRows = this._barsKeyTable.findObjects({});
  if (tableRows) {
    for (var tableRowIndex in tableRows) {
      var tableRow = tableRows[tableRowIndex];
      if (tableRow) {
        var ticker = tableRow.key.replace(TradingView.actualResolution, "").trim();
        this.feedHandler._webSocketConnection.send(JSON.stringify(
                                                          {
                                                            "ticks": ticker,
                                                            "tradingview_ticker_id": tableRow.key
                                                          }));
      }
    }
    this._barsKeyTable.update(tableRows);
  }

};
