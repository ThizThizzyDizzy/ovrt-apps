const API = new OVRT({
    "function_queue": true
});
async function initLogger(){
	let id = await API.isAppRunningWithTitle("Aincrad K/D Logger");
	if(id==-1){
		let logger = await API.spawnOverlay({
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
		logger.setContent(0, {
			"url": "logger.html",
			"width": 2048,
			"height": 2048
		});
		logger.setPinned(true);
		logger.setBrowserOptionsEnabled(false);
	}
}
function setMode(mode){
    window.localStorage.setItem("aincrad_logger:mode", mode);
}
var timer = setInterval(refreshRunningLabel, 1000);
async function refreshRunningLabel() {
	let id = await API.isAppRunningWithTitle("Aincrad K/D Logger");
	document.getElementById("openedText").innerHTML = id==-1?"":"Logger is now active!";
}
refreshRunningLabel();