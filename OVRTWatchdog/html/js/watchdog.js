const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("OVRT Watchdog");
var mode = "background";
setMode(mode);
var lastLine = 0;

var updateInterval = 100;
var timer = setInterval(scanLog, updateInterval);

async function scanLog() {
    let path = await API.getLastModifiedFileInDirectory("OVRT-LocalLow/Curtis English/OVR Toolkit/");
    let contents = await API.getFileStringContents(path+"/../Player.log");
	
	if (contents.includes("Still reading file")) {
		clearInterval(timer);
        log("OVRT Watchdog", "Lag detected! increasing scan interval");
		updateInterval += 100;
        timer = setInterval(scanLog, updateInterval);
	}

    let newMode = window.localStorage.getItem("ovrt_watchdog:mode");
    if(!newMode||newMode==null)newMode = "background";
    if(newMode!==mode){
        setMode(newMode);
    }
	
    var lines = contents.split("\n");
    if(lines.length<lastLine)return;
    if(lastLine===0){
        log("OVRT Watchdog", "Watchdog Initializing");
        lastLine = lines.length-1;
        if(lastLine<1)lastLine = 1;//to stop double-initializing if the logfile is still empty
    }else{
        let message = "";
        for (;lastLine < lines.length-1; lastLine++) {
            var line = lines[lastLine].trim();
            if(line.startsWith("(Filename")||lastLine===lines.length-2){
                message = (message+line).trim();
                if(message!==""){
                    if(message.includes("Uncaught")||message.includes("Exception")||message.includes("Error")){
                        error("OVRToolkit", message);
                    }else if(message.startsWith("GetUniqueID: ")||message.includes("Custom App")||message.includes("permissions.json")||message.startsWith("[WebAPI]")||message.startsWith("Web API: ")||message.startsWith("OSC: ")){
                        warn("OVRToolkit", message);
                    }else log("OVRToolkit", message);
                }
                message = "";
            }else message+=line+"\n";
            // if(line.includes("Exception")||line.includes("Error")||line.includes("Custom App")||line.includes("permissions.json")||line.startsWith("[WebAPI]")||line.startsWith("OSC: ")){
            //     log("OVRToolkit", line);
            // }
        }
    }
}
async function setMode(newMode){
    mode = newMode;
    let ovrly = new OVRTOverlay(await API.getUniqueID());
    if(mode==="background"){
        ovrly.setPosition(1000,1000,1000);
		ovrly.setRenderingEnabled(false);
    }
    if(mode==="console"){
        logEvents = [];
        document.getElementById("console").innerHTML = "";
        let tf = await ovrly.getTransform();
        if(tf.posX+tf.posY+tf.posZ>2000){
            ovrly.bringToMe();//very unlikely you'll have it 2km away aside from background mode
            ovrly.setOpacity(1);
            ovrly.setFramerate(60);
        }
        ovrly.setRenderingEnabled(true);
        ovrly.setBrowserOptionsEnabled(false);
    }
}
var logEvents = [];
function logEvent(str){
    logEvents.push(str);
    if(logEvents.length>1000)logEvents = logEvents.splice(0, 1);
    let s = "";
    for(let event of logEvents)s += event.replace('\n','<br>')+"<br>\n";
    document.getElementById("console").innerHTML = s;
    window.scrollTo(0, document.body.scrollHeight);
}
function log(title, message){
    if(mode==="console")logEvent("INFO ["+title+"] "+message);
}
function warn(title, message){
    if(mode==="console")logEvent("<p style='color:yellow;'>WARN ["+title+"] "+message+"</p>");
    if(mode==="background")API.sendNotification("OVRT Watchdog - WARN", "["+title+"] " + message);
}
function error(title, message){
    if(mode==="console")logEvent("<p style='color:red;'>ERROR ["+title+"] "+message+"</p>");
    if(mode==="background")API.sendNotification("OVRT Watchdog - ERROR", "["+title+"] " + message);
}