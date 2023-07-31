const API = new OVRT({
    "function_queue": true
});
var self;
var onCleanup = function (){};
API.getUniqueID().then((uid)=>{
    self = new OVRTOverlay(uid);
    self.setBrowserOptionsEnabled(false);
    self.setInputBlocked(true);
    self.setPinned(true);
});
API.blockMovement(true);
API.on("overlay-message", async function (event){
    let msg = event.message;
    if(msg&&msg.app==="OVR Thizkit"){
        if(msg.event==="cleanup"){
            onCleanup();
            self.close();
        }
        if(msg.event==="remote_query"){
            let callback = msg.callback;
            let result = await window[msg.name].apply(window, msg.args);
            API.sendMessage(msg.response_uid, {
                app:"OVR Thizkit",
                event:"remote_response",
                callback,
                data: result
            });
        }
        if(msg.event==="remote_response"){
            window.callGlobalCallback(msg.data, msg.callback);
        }
    }
});
function setTitle(title){
    API.setCurrentBrowserTitle(title);
}
async function getThizkitController(){
    let uid = await API.isAppRunningWithTitle("OVR Thizkit");
    if(uid==-1)console.log("Could not find Thizkit Controller!");
    return (uid);
}
async function getRemoteUtilityOverlay(rightHand, force = false){
    return await runThizkitRemoteFunction("getUtilityOverlay", [rightHand, force]);
}
async function releaseRemoteUtilityOverlay(uid){
    return await runThizkitRemoteFunction("releaseUtilityOverlay", [uid]);
}
function runThizkitRemoteFunction(name,args){
    return new Promise((resolve)=>{
        const callback = window.registerGlobalCallback(this, result => {
            return resolve(result);
        });
        getThizkitController().then((thizkit)=>{
            API.sendMessage(thizkit, {
                app:"OVR Thizkit",
                event:"remote_query",
                response_uid: self._uid,
                callback,
                name,
                args
            });
        });
    });
}
async function getRemoteLocalURL(path){
    return (await runThizkitRemoteFunction("getLocalURL", [await API.getUniqueID(), path]))[0];
}
function makeLocalURL(url, path){
    return "../../../../../../../../../../../"+url.substring(11, Math.max(url.lastIndexOf('/'), url.lastIndexOf('\\'))+1)+path;
}
var stable = []
function stabilize(key, vec){
    if(!stable[key])stable[key] = vec;
    let dx = vec.x-stable[key].x;
    let dy = vec.y-stable[key].y;
    let dz = vec.z-stable[key].z;
    let amount = 1/Math.max(1,1/(Math.sqrt(dx*dx+dy*dy+dz*dz)*25));
    stable[key].x = lerp(stable[key].x, vec.x, amount);
    stable[key].y = lerp(stable[key].y, vec.y, amount);
    stable[key].z = lerp(stable[key].z, vec.z, amount);
    return stable[key];
}
function lerp(y1, y2, x){
    return y1+(y2-y1)*x;
}
function lerpEuler(y1, y2, x){
    if(y1<=-180)y1+=360;
    if(y2<=-180)y2+=360;
    if(y1>180)y1-=360;
    if(y2>180)y2-=360;
    if(y1<-90&&y2>90)return lerpEuler2(y1, y2, x);
    if(y2<-90&&y1>90)return lerpEuler2(y2, y1, 1-x);
    return lerp(y1,y2,x);
}
function lerpEuler2(y1, y2, x){//y2 >90, y1 <-90, interpolate through +-180
    let v = lerp(y1, y2-360, x);
    if(v<=-180)v+=360;
    return v;
}