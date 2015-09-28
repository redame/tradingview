#TradingView Implementation for Binary.com
[![Build Status](https://travis-ci.org/binary-com/tradingview.svg?branch=master)

This repository contains HTML, Javascript, CSS, and images content of the [TradingView implementation for binary.com charts](http://binary-com.github.io/tradingview).

The project is coded in a way that same codebase could be used for both Mobile and Web.

It uses IntelXDK for generate Hybrid package for distribution in Apple and Google play store. For now, we are supporting iOS and Android devices only.

#Code/Folder details

<strong>bower_components</strong> - We use bower to manager dependencies. This folder holds all the dependent libraries

<strong>chart_library/datafeed</strong> - Our custom code to implement tradingview charting library

<strong>common.js</strong> - All commong JS functions

<strong>demo</strong> - Any demo/example code of different features of this project

<strong>images</strong> - Static resource files

<strong>index.html</strong> - Main starting page of this project. It will redirect to the appropriate current production/beta version

<strong>main.css</strong> - CSS used in main.html

<strong>main.html</strong> - Our main flie for this project

<strong>main.js</strong> - Our main JS file used in main.html

<strong>mobile_assets</strong> - All mobile related image/icon files
