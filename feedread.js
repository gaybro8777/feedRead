var myProductName = "davefeedread"; myVersion = "0.5.2";   

/*  The MIT License (MIT)
	Copyright (c) 2014-2018 Dave Winer
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
	*/

exports.parseString = parseFeedString;
exports.parseUrl = parseFeedUrl;
exports.getCharset = getCharset;

const utils = require ("daveutils");
const feedParser = require ("feedparser");
const request = require ("request");
const stream = require ("stream");
const iconv = require ("iconv-lite");

const metaNames = { 
	title: true,
	link: true,
	description: true,
	pubDate: true,
	language: true,
	copyright: true,
	generator: true,
	cloud: true,
	image: true,
	categories: true
	};

function getCharset (httpResponse) {
	var contentType = httpResponse.headers ["content-type"];
	if (contentType !== undefined) {
		var encoding = utils.trimWhitespace (utils.stringNthField (contentType, ";", 2));
		if (encoding.length > 0) {
			var charset = utils.trimWhitespace (utils.stringNthField (encoding, "=", 2));
			return (charset);
			}
		}
	return (undefined); //no charset specified
	}
function parseFeedString (theString, charset, callback, errMsgPrefix) {
	var feedparser = new feedParser ();
	var theFeed = {
		head: new Object (),
		items: new Array ()
		};
	var flCalledBack = false; //1/29/19 by DW
	function consoleMessage (s) {
		}
	if (charset !== undefined) {
		try {
			theString = iconv.decode (theString, charset); //4/18/18 by DW -- use iconv-lite
			}
		catch (err) {
			consoleMessage ("err.message == " + err.message);
			if (callback !== undefined) { //1/26/19 by DW
				flCalledBack = true;
				callback (err);
				}
			}
		}
	
	var theStream = new stream.Readable;
	theStream.push (theString);
	theStream.push (null);
	
	feedparser.on ("readable", function () {
		try {
			var item = this.read ();
			if (item !== null) {
				theFeed.items.push (item);
				for (var x in item.meta) {
					if (metaNames [x] !== undefined) {
						theFeed.head [x] = item.meta [x];
						}
					}
				}
			}
		catch (err) {
			console.log ("parseFeedString: err.message == " + err.message);
			}
		});
	feedparser.on ("error", function (err) {
		consoleMessage ("err.message == " + err.message);
		if (!flCalledBack) { //make sure the callback is only called once -- 1/29/19 by DW
			flCalledBack = true;
			if (callback !== undefined) {
				callback (err, theFeed);
				}
			}
		});
	feedparser.on ("end", function () {
		if (!flCalledBack) {
			flCalledBack = true;
			if (callback !== undefined) {
				callback (undefined, theFeed);
				}
			}
		});
	
	theStream.pipe (feedparser);
	}
function parseFeedUrl (feedUrl, timeOutSecs, callback) {
	var theRequest = {
		url: feedUrl, 
		encoding: null,
		jar: true,
		gzip: true,
		maxRedirects: 5,
		headers: {
			"User-Agent": myProductName + " v" + myVersion
			}
		};
	if (timeOutSecs !== undefined) {
		theRequest.timeout = timeOutSecs * 1000;
		}
	request (theRequest, function (err, response, theString) {
		if (err) {
			if (callback !== undefined) {
				var theErrorResponse = {
					statusCode: 400 //something like ENOTFOUND or ETIMEDOUT
					};
				callback (err, undefined, theErrorResponse);
				}
			}
		else {
			if (response.statusCode != 200) {
				if (callback !== undefined) {
					var theErrorResponse = {
						message: "Error reading the feed, response.statusCode == " + response.statusCode + ".",
						statusCode: response.statusCode
						};
					callback (theErrorResponse, undefined, response);
					}
				}
			else {
				parseFeedString (theString, getCharset (response), function (err, theFeed) {
					if (callback !== undefined) {
						callback (err, theFeed, response); //4/17/18 by DW -- pass err back to caller
						}
					}, myProductName + ": feedUrl == " + feedUrl);
				}
			}
		});
	}
