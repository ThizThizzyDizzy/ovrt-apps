var apiInit = false;

var lastLine = 0;

var lastPlayerJoin = "";
var lastPlayerLeft = "";
var lastPortal = "";

var firstLogCheck = false;

var updateInterval = 500;
var timer = setInterval(GetLog, 500);

const API = new OVRT();

var currentPath = "";

// Start getting the log file.
function GetLog() {
	if (!apiInit) {
		if (typeof SetBrowserTitle === "function") {
			SetBrowserTitle("OVRT Watchdog");
			apiInit = true;
		}
		return;
	}
    API.getLastModifiedFileInDirectory("OVRT-LocalLow/Curtis English/OVR Toolkit/").then(
        function(path){
//            if(path.includes("Player.log")){
                API.getFileStringContents(path).then(
                    function(contents) {
                       FileContents(contents);
                    }
                );
//            }
        }
    );
}

function FileContents(contents) {
	var body = "";
	
	if (contents.includes("Still reading file")) {
		clearInterval(timer);
        body = "Lag detected! increasing scan interval\n";
		setTimeout(function(){ updateInterval = updateInterval + 500; timer = setInterval(GetLog, updateInterval); }, 4000);
	}
	
    var lines = contents.split("\n");
    if(lines.length<lastLine)return;
    if(lastLine===0){
        body += "Watchdog Initializing\n";
        lastLine = lines.length-1;
        if(lastLine<1)lastLine = 1;//to stop double-initializing if the logfile is still empty
    }else{
        for (;lastLine < lines.length; lastLine++) {
            var line = lines[lastLine];
            if(line.includes("Exception")||line.includes("Error")||line.includes("Custom App")||line.includes("permissions.json")||line.startsWith("[WebAPI]")||line.startsWith("OSC: ")){
                body += line+"\n";
            }
        }
    }
	
	if (body.length > 0) {
		API.sendNotification("OVRT Watchdog", body);
	}
}