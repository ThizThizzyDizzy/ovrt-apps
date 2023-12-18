const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("Aincrad K/D Logger");
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const modeLock = urlParams.get("mode");
var data = JSON.parse(localStorage.getItem("ArgusVRC_ProjectAincrad:KillDeathStats"));
if(!data){
    data = {};
}
var mode = "background";
if(modeLock&&modeLock!=null)mode = modeLock;
setMode(mode);
var lastLine = 0;

var updateInterval = 100;
var timer = setInterval(scanLog, updateInterval);

async function scanLog() {
    let path = await API.getLastModifiedFileInDirectory("OVRT-LocalLow/VRChat/VRChat/");
    let contents = await API.getFileStringContents(path);
	
	if (contents.includes("Still reading file")) {
		clearInterval(timer);
        API.sendNotification("Aincrad K/D Logger", "Lag detected! increasing scan interval");
		updateInterval += 100;
        timer = setInterval(scanLog, updateInterval);
        return;
	}

    if(!modeLock||modeLock==null){
        let newMode = window.localStorage.getItem("aincrad_logger:mode");
        if(!newMode||newMode==null)newMode = "background";
        if(newMode!==mode){
            setMode(newMode);
        }
    }
	
    var lines = contents.split("\n");
    if(lines.length<lastLine)return;
    if(lastLine===0){
        API.sendNotification("Aincrad K/D Logger", "Aincrad Logger Initializing");
        lastLine = lines.length-1;
        if(lastLine<1)lastLine = 1;//to stop double-initializing if the logfile is still empty
    }else{
        for (;lastLine < lines.length-1; lastLine++) {
            var line = lines[lastLine].trim();
            if(line!=="" && line.includes("ArgusVRC_ProjectAincrad")){
                logEvent(line.substring(line.indexOf("ArgusVRC_ProjectAincrad")+"ArgusVRC_ProjectAincrad".length+1).trim());
            }
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
        }
        ovrly.setFramerate(60);
        ovrly.setRenderingEnabled(true);
        ovrly.setBrowserOptionsEnabled(false);
        logConsole("Console enabled");
    }
}
var logEvents = [];
function logConsole(str){
    let date = new Date();
    let timestamp = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+fmt(date.getHours())+":"+fmt(date.getMinutes())+":"+fmt(date.getSeconds())+" ";
    str = insertInsidePTag(str, timestamp);

    logEvents.push(str);
    if(logEvents.length>1000)logEvents = logEvents.splice(0, 1);
    let s = "";
    for(let event of logEvents)s += event.replace('\n','<br>')+"<br>\n";

    // Now do totals
    s += "<br>\n";
    if(data.EntityKilled){
        let entities = {};
        if(data.EntityKilled.entities){
            for(let entity in data.EntityKilled.entities){
                if(!entities[entity])entities[entity] = 0;
                entities[entity]+=data.EntityKilled.entities[entity];
            }
        }
        if(data.EntityKilled.indirect){
            for(let entity in data.EntityKilled.indirect){
                if(!entities[entity])entities[entity] = 0;
                entities[entit+y]+=data.EntityKilled.indirect[entity];
            }
        }
        s+="<br>Entities Killed:\n";
        for(let entity in entities){
            s+="<br>"+entities[entity]+"x "+entity+"\n";
        }
    }
    if(data.PlayerKilled){
        let players = {};
        if(data.PlayerKilled.entities){
            for(let player in data.PlayerKilled.entities){
                if(!players[player])players[player] = 0;
                players[player]+=data.PlayerKilled.entities[player];
            }
        }
        if(data.PlayerKilled.indirect){
            for(let player in data.PlayerKilled.indirect){
                if(!players[player])players[player] = 0;
                players[player]+=data.PlayerKilled.indirect[player];
            }
        }
        s+="<br>Players Killed:\n";
        for(let player in players){
            s+="<br>"+players[player]+"x "+player+"\n";
        }
    }
    if(data.PlayerDied){
        let deaths = {};
        if(data.PlayerDied.entities){
            for(let death in data.PlayerDied.entities){
                if(!deaths[death])deaths[death] = 0;
                deaths[death]+=data.PlayerDied.entities[death];
            }
        }
        if(data.PlayerDied.indirect){
            for(let death in data.PlayerDied.indirect){
                if(!deaths[death])deaths[death] = 0;
                deaths[death]+=data.PlayerDied.indirect[death];
            }
        }
        s+="<br>Deaths:\n";
        for(let death in deaths){
            s+="<br>"+deaths[death]+"x "+death+"\n";
        }
    }

    document.getElementById("console").innerHTML = s;
    window.scrollTo(0, document.body.scrollHeight);
}
function fmt(num){
    num = num+"";
    if(num.length<2)num = "0"+num;
    return num;
}

function insertInsidePTag(str, text){
    const start = str.indexOf('<p');
    const end = str.indexOf('>', start);
    
    if(start===0&&end!==-1){
        return str.slice(0, end+1)+text+str.slice(end+1);
    }else{
        return text+str;
    }
}

function logEvent(event){
    if(mode==="background")API.sendNotification("Aincrad K/D Logger", event);
    let eventS = [event.split(" ")[0],event.split(" ").slice(1).join(' ')];
    let eventType = eventS[0];
    let eventSubjects = eventS[1].split(":")[0].includes("|")?[eventS[1].split("|")[0],eventS[1].split("|").slice(1).join("|")]:[eventS[1]];
    if(!data[eventType])data[eventType] = {};
    if(eventSubjects.length==2){
        if(!data[eventType].indirect)data[eventType].indirect = {};
        if(!data[eventType].other)data[eventType].other = {};
        if(!data[eventType].other[eventSubjects[0]])data[eventType].other[eventSubjects[0]] = 0;
        data[eventType].other[eventSubjects[0]]++;
        
        if(!data[eventType].indirect[eventSubjects[1]])data[eventType].indirect[eventSubjects[1]] = 0;
        data[eventType].indirect[eventSubjects[1]]++;
    }else{
        if(!data[eventType].entities)data[eventType].entities = {};
        if(!data[eventType].entities[eventSubjects[0]])data[eventType].entities[eventSubjects[0]] = 0;
        data[eventType].entities[eventSubjects[0]]++;
    }
    save();
    if(mode==="console")logConsole(event);
    /*
    EntityKilled NPC: Boar 
    PlayerDied NPC: Boar 
    PlayerDied NPC: Kobold Sentinel 
    PlayerKilled Player: FTWGaming0
    PlayerDied Player: FTWGaming0
    PlayerKilled Poison|Player: FTWGaming0
    PlayerDied FallDamage|NPC: Wasp 
    PlayerDied Player: BocuD
    PlayerDied FallDamage|Player: BocuD
    */
}
function save(){
    localStorage.setItem("ArgusVRC_ProjectAincrad:KillDeathStats", JSON.stringify(data));
}