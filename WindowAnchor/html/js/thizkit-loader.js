async function loadAnchor(){
    let self = new OVRTOverlay(await API.getUniqueID());
    var id = localStorage.getItem("window_anchor:lastID");
    if(!id)id = -1;
    id++;
    localStorage.setItem("window_anchor:lastID", id);
    var key = "anchor_"+id;
    if(localStorage.getItem(key))localStorage.removeItem(key);//clear previous settings just in case of duplicates
    let url = await getRemoteLocalURL("thizkit-anchor.html?id="+id);
    self.setSize(0.18);
    self.setContent(0, {
        url,
        width: 500,
        height: 500
    });
}
loadAnchor();