const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("OSC Macros");
let edit = false;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const panelId = urlParams.get("id");
const width = urlParams.get("width");
const height = urlParams.get("height");
var storage = window.localStorage;
var data = JSON.parse(storage.getItem("osc_macros_"+panelId));
API.on("message", async function (event){
    let msg = event.message;
    if(msg&&msg.app==="OSC Macros"){
        if(msg.event==="editmacros"){
            edit = true;
        }
        if(msg.event==="doneediting"){
            edit = false;
            buttonSaveSettings();
        }
    }
});
if(!data){
    edit = true;//assume edit mode is on when creating new overlays
    data = [];
    for(let i = 0; i<width*height; i++){
        data.push({
            label: "Unnamed",
            path: "/avatar/parameters/",
            value: "",
            type: 3
        });
    }
}
let str = "";
let btnIdx = 0;
for(let y = 0; y<height; y++){
    for(let x = 0; x<width; x++){
        str+="<button onclick='runMacro("+btnIdx+")' style='position:fixed; left:"+x*200+"px; top:"+y*200+"px;' id='macro-"+btnIdx+"'>"+data[btnIdx].label+"</button>";
        btnIdx++;
    }
    str+="<br>";
}
document.getElementById("macros").innerHTML = str;
function runMacro(id){
    if(edit){
        editing = data[id];
        editingID = id;
        document.getElementById("macros").hidden = true;
        document.getElementById("settings").hidden = false;
        document.getElementById("in-label").value = editing.label;
        document.getElementById("in-path").value = editing.path;
        document.getElementById("in-val").value = editing.value;
        document.getElementById("btn-type").innerHTML = getTypeName(editing.type);
        return;
    }
    API.sendOSCMessage(data[id].path, data[id].value, data[id].type)
}
function getTypeName(id){
    if(id==0)return "Int";
    if(id==1)return "Float";
    if(id==2)return "Bool";
    if(id==3)return "String";
    return "null";
}
function buttonTypeChange(){
    editing.type++;
    if(editing.type>3)editing.type = 0;
    document.getElementById("btn-type").innerHTML = getTypeName(editing.type);
}
function buttonValueChange(){
    editing.value = document.getElementById("in-val").value;
}
function buttonPathChange(){
    editing.path = document.getElementById("in-path").value;
}
function buttonLabelChange(){
    editing.label = document.getElementById("in-label").value;
}
function buttonSaveSettings(){
    document.getElementById("macros").hidden = false;
    document.getElementById("settings").hidden = true;
    document.getElementById("macro-"+editingID).innerHTML = data[editingID].label;
    save();
}
function save(){
    storage.setItem("osc_macros_"+panelId, JSON.stringify(data));
}