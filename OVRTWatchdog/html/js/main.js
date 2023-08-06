const API = new OVRT({
    "function_queue": true
});
async function initWatchdog(){
	let id = await API.isAppRunningWithTitle("OVRT Watchdog");
	if(id==-1){
		let watchdog = await API.spawnOverlay({
			"posX": 1000, 
			"posY": 1000, 
			"posZ": 1000, 
			"rotX": 0, 
			"rotY": 0, 
			"rotZ": 0, 
			"size": 0.3, 
			"opacity": 0.001, 
			"curvature": 0, 
			"framerate": 1, 
			"ecoMode": false, 
			"lookHiding": false, 
			"attachedDevice": 0, 
			"shouldSave": true
		});
		watchdog.setContent(0, {
			"url": "watchdog.html",
			"width": 2048,
			"height": 2048
		});
		watchdog.setPinned(true);
		watchdog.setBrowserOptionsEnabled(false);
	}
}
function setMode(mode){
    window.localStorage.setItem("ovrt_watchdog:mode", mode);
}
var timer = setInterval(refreshRunningLabel, 1000);
async function refreshRunningLabel() {
	let id = await API.isAppRunningWithTitle("OVRT Watchdog");
	document.getElementById("openedText").innerHTML = id==-1?"":"Watchdog is now active!";
}
refreshRunningLabel();