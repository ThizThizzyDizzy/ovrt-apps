const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("Sticky Note");
let edit = false;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const noteId = urlParams.get("id");
const col = urlParams.get("col");
const headerColors = ["FFF2AB", "CBF1C4", "FFCCE5", "E7CFFF", "CDE9FF", "FFD6AD", "E1DFDD", "494745"];
const bodyColors = ["FFF7D1", "E4F9E0", "FFE4F1", "F2E6FF", "E2F1FF", "FFE7D1", "F3F2F1", "696969"];
document.getElementById("note-header").style.backgroundColor = "#"+headerColors[col];
document.getElementById("note").style.backgroundColor = "#"+bodyColors[col];
document.getElementById("note").style.color = (col==7?"#EEEEEE":"#111111");
var storage = window.localStorage;
var data = storage.getItem("sticky_note_"+noteId);
if(!data)data = ""; 
document.getElementById("note").value = data;
function save(){
    storage.setItem("sticky_note_"+noteId, document.getElementById("note").value);
}