var apiInit = false;
var recievedStartupCommand = false;

var timer = setInterval(refreshRunningLabel, 1000);
	
var overlayTransform = { 
	"posX": 1000, 
	"posY": 1000, 
	"posZ": 1000, 
	"rotX": 0, 
	"rotY": 0, 
	"rotZ": 0, 
	"size": 0.1, 
	"opacity": 0.001, 
	"curvature": 0, 
	"framerate": 1, 
	"ecoMode": false, 
	"lookHiding": false, 
	"attachedDevice": 0, 
	"shouldSave": true
};

var webContents = {
	"url": "manager.html",
	"width": 8,
	"height": 8
};

function initWatchdog() {
    recievedStartupCommand = true;
	if (apiInit) {
		IsAppRunningWithTitle("OVRT Watchdog");
	}
}

function refreshRunningLabel() {
	if (apiInit) {
        recievedStartupCommand = false;
		IsAppRunningWithTitle("OVRT Watchdog");
        setTimeout(function(){ timer = setInterval(refreshRunningLabel, 60000); }, 1000);
	}
}

function FoundWindow(id) {
	if (id == -1) {
		if(recievedStartupCommand)SpawnOverlay(JSON.stringify(overlayTransform), "OverlaySpawned");
        else document.getElementById("openedText").style.opacity = 0;
	}else{
        if(!recievedStartupCommand)document.getElementById("openedText").style.opacity = 1;
    }
}

// Called when OVR Tookit's API is injected.
function APIInit() {
	apiInit = true;
    IsAppRunningWithTitle("OVRT Watchdog");
}

// Called when an overlay is spawned.
function OverlaySpawned(uid) {
	setTimeout(function() { SetContents("" + uid, 0, JSON.stringify(webContents)) }, 100);
	setTimeout(function() { SetOverlaySetting("" + uid, 7, true) }, 200);
	setTimeout(function() { SetOverlaySetting("" + uid, 9, true) }, 300);
	document.getElementById("openedText").style.opacity = 1;
}
