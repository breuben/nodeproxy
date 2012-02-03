var http = require("http");
var https = require("https");
var url = require("url");
var fs = require("fs");
var net = require("net");

var serverPort = 7777;

function writeLog(message)
{
	message += "\n";
	var path = "log.txt";
	var logFile = fs.openSync(path, "a");
	fs.writeSync(logFile, message, 0, null);
	fs.closeSync(logFile);
}

function getPort(uri)
{
	if (uri.port != undefined)
		return uri.port;
	else if (uri.protocol == "https")
		return 443;
	else
		return 80;
}

function makeRequest(request, callback)
{
	var requestUrl = url.parse(request.url);

	var options = {
		host: request.headers.host,
		port: getPort(requestUrl),
		path: requestUrl.pathname,
		method: request.method,
		headers: request.headers
	}

	delete options.headers.host;
	delete options.headers["proxy-connection"];

	if (requestUrl.protocol == "https")
		return https.request(options, callback);
	else
		return http.request(options, callback);
}

function onStart(localRequest, localResponse)
{
	//console.log("Serving request for " + localRequest.url);

	if (localRequest.method == "CONNECT")
		console.log("received CONNECT request in weird place");

	var remoteRequest = makeRequest(localRequest, requestComplete);
	remoteRequest.on("error", requestError);

	localRequest.on("data", function(chunk)
	{
		remoteRequest.write(chunk);
	});

	localRequest.on("end", function()
	{
		remoteRequest.end();
	});

	function requestComplete(remoteResponse)
	{
		localResponse.writeHead(remoteResponse.statusCode, remoteResponse.headers);

		remoteResponse.on("data", function(chunk)
		{
			localResponse.write(chunk);
		});

		remoteResponse.on("end", function()
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

server.on("upgrade", function(request, socket, head)
{
	if (request.method == "CONNECT")
	{
		var u = url.parse("http://" + request.url);
		runSocketProxy(u.hostname, u.port, socket);
	}
	else
	{
		var message = "HTTP/1.0 501 Not Implemented\r\n" +
			"Content-Type: text/plain\r\n" +
			"\r\n" +
			"The request type is not supported by the proxy server\r\n";

		console.log(request.method);

		socket.write(message, "utf-8", function()
		{
			console.log("Closing socket connection.");
			socket.end();
		});
	}
});

function runSocketProxy(host, port, localSocket)
{
	console.log("Serving CONNECT request to " + host + ":" + port);
	var remoteSocket = net.createConnection(port, host, function()
	{
		var response = "HTTP/1.1 200 OK\r\n\r\n";
		localSocket.write(response, "utf8");
	});

	localSocket.on("data", function(data)
	{
		try
		{
			remoteSocket.write(data);
		}
		catch (e) { }
	});

	localSocket.on("end", function(data)
	{
		try
		{
			remoteSocket.end();
		}
		catch (e) { }
	});

	remoteSocket.on("data", function(data)
	{
		try
		{
			localSocket.write(data);
		}
		catch (e) { }
	});

	remoteSocket.on("end", function()
	{
		try
		{
			localSocket.end();
		}
		catch (e) { }
	});
}

server.listen(serverPort);
console.log("Server listening on port " + serverPort + "...");

