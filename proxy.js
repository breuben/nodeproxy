var http = require("http");
var https = require("https");
var url = require("url");
var fs = require("fs");

function makeRequest(request, callback)
{
	var options = {
		host: request.headers.host,
		path: request.url,
		method: request.method,
		headers: request.headers
	}

	return http.request(options, callback);
}

function onStart(localRequest, localResponse)
{
	console.log("Serving request for " + localRequest.url);

	var remoteRequest = makeRequest(localRequest, requestComplete);
	remoteRequest.on('error', requestError);

	localRequest.on('data', function(chunk)
	{
		remoteRequest.write(chunk);
	});

	localRequest.on('end', function()
	{
		remoteRequest.end();
	});

	function requestComplete(remoteResponse)
	{
		localResponse.writeHead(remoteResponse.statusCode);
		remoteResponse.on('data', function(chunk)
		{
			localResponse.write(chunk);
		});

		remoteResponse.on('end', function()
		{
			localResponse.end();
		});
	}

	function requestError(e)
	{
		console.log("Problem with remote request: " + e.message);
		localResponse.end();
	}

}

var server = http.createServer(onStart);
server.listen(7777);

