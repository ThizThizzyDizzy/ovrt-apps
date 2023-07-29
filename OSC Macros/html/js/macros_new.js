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
var data = JSON.parse(storage.getItem("osc_macros"));
var page = 0;
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
        data.push([{
            label: "Unnamed",
            path: "/avatar/parameters/",
            value: "",
            type: 3,
            delay: 0,
            toggled: false
        }]);
    }
}
let str = "";
let btnIdx = 0;
for(let y = 0; y<height; y++){
    for(let x = 0; x<width; x++){
        str+="<button onclick='runMacro("+btnIdx+")' style='position:fixed; left:"+x*200+"px; top:"+y*200+"px;"+(data[btnIdx].toggled?" background-color=#80c0e0;":"")+"' id='macro-"+btnIdx+"'>"+data[btnIdx].label+"</button>";
        btnIdx++;
    }
    str+="<br>";
}
document.getElementById("macros").innerHTML = str;
function runMacro(id){
    if(edit){
        editing = data[id];
        editingID = id;
        page = 0;
        document.getElementById("macros").hidden = true;
        document.getElementById("settings").hidden = false;
        refreshPage();Socks
        return;
    }
    let hasToggle = false;
    let totalDelay = 0;
    for(let macro of data[id]){
        let val = macro.value;
        let typ = macro.type;
        if(typ==4){
            typ = 2;
            val = (String(val).toLowerCase() === 'true');
            if(data[id][0].toggled)val = !val;
            hasToggle = true;
        }
        totalDelay += Number(macro.delay);
        setTimeout(function(){
            API.sendOSCMessage(macro.path, val, typ)
        }, totalDelay);
    }
    if(hasToggle){
  		data[id][0].toggled = !data[id][0].toggled;
  		document.getElementById("macro-"+id).style.backgroundColor = data[id][0].toggled?"#80c0e0":"#999999";
    }
}
function refreshPage(){
	if(page==0)document.getElementById("in-label").value = editing[page].label;
  document.getElementById("in-label").hidden = page>0;
  document.getElementById("lbl-page").hidden = page==0;
  document.getElementById("lbl-page").style.display = page==0?"none":"flex";
  document.getElementById("lbl-page").innerHTML = editing[0].label+": Page "+(page+1);
  document.getElementById("in-path").value = editing[page].path;
  document.getElementById("in-val").value = editing[page].value;
  document.getElementById("in-delay").value = editing[page].delay;
  document.getElementById("btn-type").innerHTML = getTypeName(editing[page].type);
	document.getElementById("btn-prev").hidden = page==0;
	document.getElementById("btn-del").hidden = page==0;
  document.getElementById("btn-next").innerHTML = page==editing.length-1?"+":">";
}
function getTypeName(id){
    if(id==0)return "Int";
    if(id==1)return "Float";
    if(id==2)return "Bool";
    if(id==3)return "String";
    if(id==4)return "Bool (Toggle)";
    return "null";
}
function buttonTypeChange(){
    editing[page].type++;
    if(editing[page].type>4)editing[page].type = 0;
    document.getElementById("btn-type").innerHTML = getTypeName(editing[page].type);
}
function buttonDelayChange(){
    editing[page].delay = document.getElementById("in-delay").value;
}
function buttonValueChange(){
    editing[page].value = document.getElementById("in-val").value;
}
function buttonPathChange(){
    editing[page].path = document.getElementById("in-path").value;
}
function buttonLabelChange(){
    editing[0].label = document.getElementById("in-label").value;
}
function buttonNext(){
	if(page==editing.length-1){
  	editing.push({
      path: "/avatar/parameters/",
      value: "",
      type: 3,
      delay: 0
    });
  }
  page++;
  refreshPage();
}
function buttonPrevious(){
  page--;
  refreshPage();
}
function buttonDelete(){
	editing.splice(page, 1);
	if(page>=editing.length)page--;
  refreshPage();
}
function buttonSaveSettings(){
    document.getElementById("macros").hidden = false;
    document.getElementById("settings").hidden = true;
    document.getElementById("macro-"+editingID).innerHTML = data[editingID][0].label;
    save();
}
function save(){
    storage.setItem("osc_macros_"+panelId, JSON.stringify(data));
}