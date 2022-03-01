//var Quaternion = require("quaternion");
status("Initializing");
const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("Window Anchor");
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const anchorID = urlParams.get("id");
var storage = window.localStorage;
var data = JSON.parse(storage.getItem("anchor_"+anchorID));
if(!data){
    data = {
        linkedWindows:{},
        lockedRot:{},
        aspectRatio:{
            x:16,
            y:9
        },
        lerping: 0,
        microSmooth: false
    };
}
if(!data.aspectRatio){
    data.aspectRatio = {
        x:16,
        y:9
    };
}
if(!data.lerping){
    data.lerping = 0;
}
updateAspectRatio();
updateLerp();
updateMicroSmooth();
var anchorEnabled = true;
var snapEnabled = false;
var lockRot = false;
var lockPos = false;
var moveAny = false;
var lockedRot = data.lockedRot;
var uid = -1;
var snapDist = 0.05;//5cm
var maxDist = 50;
var selfTransform = {};
const rad = Math.PI / 180;
var startingUp = true;
var refreshNeeded = false;
API.getUniqueID().then(async function(id){
    uid = id;
    status("Loading Data");
    if(data.anchorEnabled===false)toggleAnchor();
    if(data.snapEnabled)toggleSnap();
    let o = new OVRTOverlay(uid);
    selfTransform = await o.getTransform();
    if(data.lockRot){
        o.setRotation(lockedRot.rotX,selfTransform.rotY,lockedRot.rotZ);
        toggleFlat();
    }
    if(data.lockPos)toggleLock();
    if(data.moveAny)toggleMove();
    for(const wid in data.linkedWindows){
        let w = data.linkedWindows[wid];
        delete data.linkedWindows[wid];
        let window = await getClosestWindow(w.transform);
        window.offset = w.offset;
        data.linkedWindows[window.id] = window;
    }
    resetTooltip();
    status("Ready");
    startingUp = false;
});
var anchorWasMoving = false;
var updatingLoc = false;
var deviceUpdates = {};
var grabbedWindow = -1;
var utility = null;
API.on("device-position", function (event){
    deviceUpdates[event.deviceId] = event.deviceInfo;
});
API.on("message", function (event){
    let msg = event.message;
    if(msg&&msg.app==="WindowAnchor"&&msg.event==="detach"){
        detachWindow(msg.window);
    }
});
API.on("overlay-changed", async function (event){
    if(startingUp||updatingLoc)return;
    if(uid===event.uid){
        let fastest = null;
        let fastestDiff = 0;
        let numFast = 0;
        for(const id in data.linkedWindows){
            let transform = data.linkedWindows[id].transform;
            let tf = await data.linkedWindows[id].overlay.getTransform();
            let dx = tf.posX-transform.posX;
            let dy = tf.posY-transform.posY;
            let dz = tf.posZ-transform.posZ;
            let drx = tf.rotX-transform.rotX;
            let dry = tf.rotY-transform.rotY;
            let drz = tf.rotZ-transform.rotZ;
            let dr = Math.abs(drx)+Math.abs(dry)+Math.abs(drz);
            let dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(dist>.00001){//||dr>1){
                numFast++;
                if(dist>fastestDiff||fastest===null){
                    fastest = id;
                    fastestDiff = dist;
                }
            }
            data.linkedWindows[id].transform = tf;
        }
        let sdx = event.transform.posX-selfTransform.posX;
        let sdy = event.transform.posY-selfTransform.posY;
        let sdz = event.transform.posZ-selfTransform.posZ;
        let sdrx = event.transform.rotX-selfTransform.rotX;
        let sdry = event.transform.rotY-selfTransform.rotY;
        let sdrz = event.transform.rotZ-selfTransform.rotZ;
        selfTransform = event.transform;
        let sdr = Math.abs(sdrx)+Math.abs(sdry)+Math.abs(sdrz);
        let selfDist = Math.sqrt(sdx*sdx+sdy*sdy+sdz*sdz);
        let anchorMoving = selfDist>.00001;//||sdr>1;
//        if(numFast===0&&!anchorMoving&&!refreshNeeded)return;//nothing's moved; do nothing CAUSES A BUNCH OF ISSUES
        if(snapEnabled){
            if(numFast===1){//exactly one being moved
                let holding = data.linkedWindows[fastest];
                let holdingPoints = await getAnchorPoints(holding);
                for(const id in data.linkedWindows){
                    if(id===fastest)continue;
                    let ref = data.linkedWindows[id];
                    let refPoints = await getAnchorPoints(ref);
                    if(getDist(refPoints.right, holdingPoints.left)<snapDist){//snap to right
                        let lockYaw = ref.transform.rotZ!==0||ref.transform.rotX!==0;
                        holding.overlay.setPosition(ref.transform.posX,ref.transform.posY,ref.transform.posZ);
                        holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        let r = 1;
                        let f = 0;
                        let rot = 0;
                        if(ref.transform.curvature>0){
                            let radius = 1/(2*Math.PI*ref.transform.curvature);
                            let radians = 1/(2*radius);
                            rot = radians/rad;
                            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
                            r = -pt[0]*2;
                            f = pt[1]*2;
                        }
                        holding.overlay.translateRight(r*ref.transform.size/2);
                        holding.overlay.translateForward(-f*ref.transform.size/2);
                        r = 1;
                        f = 0;
                        let rot2 = 0;
                        if(holding.transform.curvature>0){
                            let radius = 1/(2*Math.PI*holding.transform.curvature);
                            let radians = 1/(2*radius);
                            rot2 = radians/rad;
                            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
                            r = -pt[0]*2;
                            f = pt[1]*2;
                        }
                        if(lockYaw)holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY+rot,ref.transform.rotZ);
                        else holding.overlay.setRotation(ref.transform.rotX,holding.transform.rotY-rot2,ref.transform.rotZ);
                        holding.overlay.translateRight(r*holding.transform.size/2);
                        holding.overlay.translateForward(-f*holding.transform.size/2);
                        if(lockYaw)holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY+rot+rot2,ref.transform.rotZ);
                        else holding.overlay.setRotation(ref.transform.rotX,holding.transform.rotY,ref.transform.rotZ);
                    }
                    if(getDist(refPoints.left, holdingPoints.right)<snapDist){//snap to left
                        let lockYaw = ref.transform.rotZ!==0||ref.transform.rotX!==0;
                        holding.overlay.setPosition(ref.transform.posX,ref.transform.posY,ref.transform.posZ);
                        holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        let r = 1;
                        let f = 0;
                        let rot = 0;
                        if(holding.transform.curvature>0){
                            let radius = 1/(2*Math.PI*holding.transform.curvature);
                            let radians = 1/(2*radius);
                            rot = radians/rad;
                            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
                            r = -pt[0]*2;
                            f = pt[1]*2;
                        }
                        holding.overlay.translateRight(-r*ref.transform.size/2);
                        holding.overlay.translateForward(-f*ref.transform.size/2);
                        r = 1;
                        f = 0;
                        let rot2 = 0;
                        if(ref.transform.curvature>0){
                            let radius = 1/(2*Math.PI*ref.transform.curvature);
                            let radians = 1/(2*radius);
                            rot2 = radians/rad;
                            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
                            r = -pt[0]*2;
                            f = pt[1]*2;
                        }
                        if(lockYaw)holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY-rot,ref.transform.rotZ);
                        else holding.overlay.setRotation(ref.transform.rotX,holding.transform.rotY+rot2,ref.transform.rotZ);
                        holding.overlay.translateRight(-r*holding.transform.size/2);
                        holding.overlay.translateForward(-f*holding.transform.size/2);
                        if(lockYaw)holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY-rot-rot2,ref.transform.rotZ);
                        else holding.overlay.setRotation(ref.transform.rotX,holding.transform.rotY,ref.transform.rotZ);
                    }
                    if(getDist(refPoints.top, holdingPoints.bottom)<snapDist){//snap to top
                        let lockPitch = ref.transform.rotZ!==0;
                        holding.overlay.setPosition(ref.transform.posX,ref.transform.posY,ref.transform.posZ);
                        holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        holding.overlay.translateUp(ref.transform.size/2*data.aspectRatio.y/data.aspectRatio.x);
                        if(!lockPitch)holding.overlay.setRotation(holding.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        holding.overlay.translateUp(holding.transform.size/2*data.aspectRatio.y/data.aspectRatio.x);
                    }
                    if(getDist(refPoints.bottom, holdingPoints.top)<snapDist){//snap to bottom
                        let lockPitch = ref.transform.rotZ!==0;
                        holding.overlay.setPosition(ref.transform.posX,ref.transform.posY,ref.transform.posZ);
                        holding.overlay.setRotation(ref.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        holding.overlay.translateUp(-ref.transform.size/2*data.aspectRatio.y/data.aspectRatio.x);
                        if(!lockPitch)holding.overlay.setRotation(holding.transform.rotX,ref.transform.rotY,ref.transform.rotZ);
                        holding.overlay.translateUp(-holding.transform.size/2*data.aspectRatio.y/data.aspectRatio.x);
                    }
                }
            }
        }
        let grabPressed = false;
        for(const id in deviceUpdates){
            if(deviceUpdates[id].windowMoveDown)grabPressed = true;
        }
        if(anchorEnabled){
            if(!grabPressed)grabbedWindow = -1;
            let transform = event.transform;
            if(moveAny&&!anchorMoving&&numFast===1&&grabPressed){
                grabbedWindow = fastest;
                let thees = new OVRTOverlay(uid);
                let fasttf = data.linkedWindows[fastest].transform;
                let thisQuat = toQuat(fasttf.rotX, fasttf.rotY, fasttf.rotZ);
                let offset = data.linkedWindows[fastest].offset;
                let newRot = mulQuat(divQuat(thisQuat, offset.targRot), offset.orgRot);
                let euler = toEuler(newRot);
                let ox = -offset.posX;
                let oy = -offset.posY;
                let oz = -offset.posZ;
                let posRot = toEuler(divQuat(offset.targRot, thisQuat));
                let xz = rotatePoint(ox, oz, -posRot[1], 0, 0);
                ox = xz[0];
                oz = xz[1];
                let yz = rotatePoint(oy, oz, posRot[0], 0, 0);
                oy = yz[0];
                oz = yz[1];
                let xy = rotatePoint(ox, oy, posRot[2], 0, 0);
                ox = xy[0];
                oy = xy[1];
                let posX = fasttf.posX+ox;
                let posY = fasttf.posY+oy;
                let posZ = fasttf.posZ+oz;
                transform.posX = posX;
                transform.posY = posY;
                transform.posZ = posZ;
                transform.rotX = transform.curvature===0?euler[0]:0;
                transform.rotY = euler[1];
                transform.rotZ = euler[2];
                updatingLoc = true;
                thees.setPosition(posX,posY,posZ);
                thees.setRotation(euler[0], euler[1], euler[2]);
                updatingLoc = false;
                return;
            }
            if(lockRot){
                transform.rotX = lockedRot.rotX;
                transform.rotZ = lockedRot.rotZ;
                if(anchorWasMoving===true&&anchorMoving===false){
                    updatingLoc = true;
                    await new OVRTOverlay(uid).setRotation(transform.rotX, transform.rotY, transform.rotZ);
                    updatingLoc = false;
                }
                anchorWasMoving = anchorMoving;
            }
            for(const wid in data.linkedWindows){
                if(moveAny&&grabbedWindow===wid)continue;
                try{
                    let thisQuat = toQuat(transform.rotX, transform.rotY, transform.rotZ);
                    let offset = data.linkedWindows[wid].offset;
                    let newRot = normQuat(mulQuat(divQuat(thisQuat, offset.orgRot), offset.targRot));
                    let euler = toEuler(newRot);
                    let ox = offset.posX;
                    let oy = offset.posY;
                    let oz = offset.posZ;
                    let posRot = toEuler(divQuat(offset.orgRot, thisQuat));
                    let xz = rotatePoint(ox, oz, -posRot[1], 0, 0);
                    ox = xz[0];
                    oz = xz[1];
                    let yz = rotatePoint(oy, oz, posRot[0], 0, 0);
                    oy = yz[0];
                    oz = yz[1];
                    let xy = rotatePoint(ox, oy, posRot[2], 0, 0);
                    ox = xy[0];
                    oy = xy[1];
                    let posX = transform.posX+ox;
                    let posY = transform.posY+oy;
                    let posZ = transform.posZ+oz;
                    if(data.lerping>0||data.microSmooth){
                        let lerping = Math.max(0.1, data.lerping);
                        let amount = 1-(lerping/100);
                        let tf = await data.linkedWindows[wid].overlay.getTransform();
                        let dx = tf.posX-posX;
                        let dy = tf.posY-posY;
                        let dz = tf.posZ-posZ;
                        let dp = Math.sqrt(dx*dx+dy*dy+dz*dz)*25;
                        if(data.microSmooth&&dp>0){
                            amount/=Math.max(1,1/dp);
                        }
                        posX = lerp(tf.posX, posX, amount);
                        posY = lerp(tf.posY, posY, amount);
                        posZ = lerp(tf.posZ, posZ, amount);
//                        let q1 = normQuat(toQuat(tf.rotX, tf.rotY, tf.rotZ));
//                        let q3 = normQuat({
//                            w: lerp(q1.w, newRot.w, amount),
//                            x: lerp(q1.x, newRot.x, amount),
//                            y: lerp(q1.y, newRot.y, amount),
//                            z: lerp(q1.z, newRot.z, amount)
//                        });
//                        let e2 = toEuler(q3);
//                        euler[0] = e2[0];
//                        euler[1] = e2[1];
//                        euler[2] = e2[2];
                        euler[0] = lerpe(tf.rotX, euler[0], amount);
                        euler[1] = lerpe(tf.rotY, euler[1], amount);
                        euler[2] = lerpe(tf.rotZ, euler[2], amount);
                    }
                    data.linkedWindows[wid].overlay.setPosition(posX,posY,posZ);
                    data.linkedWindows[wid].overlay.setRotation(euler[0], euler[1], euler[2]);
                    data.linkedWindows[wid].overlay.getTransform().then(trnsfrm => {
                        if(data.linkedWindows[wid])data.linkedWindows[wid].transform = trnsfrm;
                        save();
                    });
                }catch(err){
                    delete data.linkedWindows[wid];
                    status("Lost window "+wid);
                }
            }
        }
    }
});
function lerp(y1, y2, x){
    return y1+(y2-y1)*x;
}
function lerpe(y1, y2, x){
    if(y1<=-180)y1+=360;
    if(y2<=-180)y2+=360;
    if(y1>180)y1-=360;
    if(y2>180)y2-=360;
    if(y1<-90&&y2>90)return lerpe2(y1, y2, x);
    if(y2<-90&&y1>90)return lerpe2(y2, y1, 1-x);
    return lerp(y1,y2,x);
}
function lerpe2(y1, y2, x){//y2 >90, y1 <-90, interpolate through +-180
    let v = lerp(y1, y2-360, x);
    if(v<=-180)v+=360;
    return v;
}
function rotatePoint(px, py, ang, ox, oy){
    let x = px-ox, y = py-oy;
    let s = Math.sin(ang*rad);
    let c = Math.cos(ang*rad);
    return [c*x+s*y+ox, c*y-s*x+oy];
}
function toQuat(pitch, yaw, roll){
    let cy = Math.cos(yaw*rad*0.5);
    let sy = Math.sin(yaw*rad*0.5);
    let cp = Math.cos(pitch*rad*0.5);
    let sp = Math.sin(pitch*rad*0.5);
    let cr = Math.cos(roll*rad*0.5);
    let sr = Math.sin(roll*rad*0.5);
    
    return normQuat({
        w:cr*cp*cy+sr*sp*sy,
        x:sr*cp*cy-cr*sp*sy,
        y:cr*sp*cy+sr*cp*sy,
        z:cr*cp*sy-sr*sp*cy
    });
}
function toEuler(q){
    let w = q.w;
    let x = q.x;
    let y = q.y;
    let z = q.z;
    
    let sinr_cosp = 2*(w*x+y*z);
    let cosr_cosp = 1-2*(x*x+y*y);
    let roll = Math.atan2(sinr_cosp, cosr_cosp);
    
    let sinp = 2*(w*y-z*x);
    let pitch = 0;
    if(Math.abs(sinp)>=1)pitch = Math.PI*Math.sign(sinp);
    else pitch = Math.asin(sinp);
    
    let siny_cosp = 2*(w*z+x*y);
    let cosy_cosp = 1-2*(y*y+z*z);
    let yaw = Math.atan2(siny_cosp, cosy_cosp);
    
    return [pitch/rad, yaw/rad, roll/rad];
}
async function attach(){
    let tf = await new OVRTOverlay(uid).getTransform();
    status("Attaching window");
    getClosestWindow(tf).then(window => {
        let closest = window.id;
        API.broadcastMessage({
            app:"WindowAnchor",
            event:"detach",
            window:closest
        });
        let origin = toQuat(tf.rotX, tf.rotY, tf.rotZ);
        let target = toQuat(window.transform.rotX, window.transform.rotY, window.transform.rotZ);
        window.offset = {
            posX:window.transform.posX-tf.posX,
            posY:window.transform.posY-tf.posY,
            posZ:window.transform.posZ-tf.posZ,
            orgRot: origin,
            targRot: target
        };
        window.overlay.setRecenter(false);
        data.linkedWindows[closest] = window;
        API.spawnOverlay({
            posX: window.transform.posX,
            posY: window.transform.posY,
            posZ: window.transform.posZ,
            rotX: window.transform.rotX,
            rotY: window.transform.rotY,
            rotZ: window.transform.rotZ,
            size: window.transform.size,
            opacity: window.transform.opacity,
            curvature: window.transform.curvature,
            framerate: 60,
            ecoMode: false,
            lookHiding: false,
            attachedDevice: window.transform.attachedDevice,
            shouldSave: false
        }).then(overlay => {
            overlay.translateForward(-.001);//move forwards 1mm
            overlay.setBrowserOptionsEnabled(false);
            overlay.setInputBlocked(true);
            overlay.setContent(0, {
                url: "attach.html",
                width: 100,
                height: 100
            });
        });
        save();
        status("Attached window "+closest);
        resetTooltip();
    }, () => {
        status("Nothing to attach");
    });
}
async function getWindows(tf){
    let windows = {};
    let overlays = JSON.parse(await API.getOverlays());
    for(const id of overlays){
        let overlay = new OVRTOverlay(id);
        let transform = await overlay.getTransform();
        if(transform.attachedDevice===tf.attachedDevice&&id!==uid){
            windows[id] = {
                overlay: overlay,
                transform: transform
            };
        }
    }
    return windows;
}
function getClosestWindow(transform){
    return new Promise((resolve, reject) => {
        getWindows(transform).then(windows => {
            let closest = null;
            let closestDist = 0;
            for(const id in windows){
                if(data.linkedWindows.hasOwnProperty(id))continue;
                let transfrm = windows[id].transform;
                let dx = transfrm.posX-transform.posX;
                let dy = transfrm.posY-transform.posY;
                let dz = transfrm.posZ-transform.posZ;
                let dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
                if(dist>maxDist)continue;
                if(dist<closestDist||closest===null){
                    closest = id;
                    closestDist = dist;
                }
            }
            if(closest===null)reject();
            windows[closest].id = closest;
            resolve(windows[closest]);
        });
    });
}
function status(status){
    document.getElementById("status").innerHTML = status;
}
async function detach(){
    let tf = await new OVRTOverlay(uid).getTransform();
    let farthest = null;
    let farthestDist = 0;
    for(const id in data.linkedWindows){
        let transfrm = data.linkedWindows[id].transform;
        let dx = transfrm.posX-tf.posX;
        let dy = transfrm.posY-tf.posY;
        let dz = transfrm.posZ-tf.posZ;
        let dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
        if(dist>farthestDist||farthest===null){
            farthest = id;
            farthestDist = dist;
        }
    }
    if(farthest!==null)detachWindow(farthest);
    else status("Nothing to detach");
    resetTooltip();
}
function detachWindow(id){
    let window = data.linkedWindows[id];
    API.spawnOverlay({
        posX: window.transform.posX,
        posY: window.transform.posY,
        posZ: window.transform.posZ,
        rotX: window.transform.rotX,
        rotY: window.transform.rotY,
        rotZ: window.transform.rotZ,
        size: window.transform.size,
        opacity: window.transform.opacity,
        curvature: window.transform.curvature,
        framerate: 60,
        ecoMode: false,
        lookHiding: false,
        attachedDevice: window.transform.attachedDevice,
        shouldSave: false
    }).then(overlay => {
        overlay.translateForward(-.001);//move forwards 1mm
        overlay.setBrowserOptionsEnabled(false);
        overlay.setInputBlocked(true);
        overlay.setContent(0, {
            url: "detach.html",
            width: 100,
            height: 100
        });
    });
    delete data.linkedWindows[id];
    save();
    status("Detached window "+id);
}
function save(){
    if(startingUp)return;
    data.anchorEnabled = anchorEnabled;
    data.snapEnabled = snapEnabled;
    data.lockRot = lockRot;
    data.lockPos = lockPos;
    data.moveAny = moveAny;
    data.lockedRot = lockedRot;
    storage.setItem("anchor_"+anchorID, JSON.stringify(data));
}
function tooltip(str){
    document.getElementById("header").innerHTML = str;
}
function numWindows(){
    return Object.keys(data.linkedWindows).length;
}
function numWindowsS(){
    let num = numWindows();
    return num+" window"+(num===1?"":"s");
}
function resetTooltip(){
    document.getElementById("header").innerHTML = numWindows()+" Windows";
}
async function equalizeWindows(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    let count = 0;
    let avgSize = 0;
    let avgOpacity = 0;
    let avgCurve = 0;
    for(const id in data.linkedWindows){
        let tf = await data.linkedWindows[id].overlay.getTransform();
        count++;
        avgSize+=tf.size;
        avgOpacity+=tf.opacity;
        avgCurve+=tf.curvature;
    }
    avgSize/=count;
    avgOpacity/=count;
    avgCurve/=count;
    for(const id in data.linkedWindows){
        let ov = data.linkedWindows[id].overlay;
        ov.setSize(avgSize);
        ov.setOpacity(avgOpacity);
        ov.setCurve(avgCurve);
    }
    if(we)toggleAnchor();
    status("Equalized transforms of "+numWindowsS());
}
async function straightenWindows(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    let orly = new OVRTOverlay(uid);
    let tf = await orly.getTransform();
    orly.setRotation(tf.rotX,tf.rotY,0);
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        data.linkedWindows[id].overlay.setRotation(tf.rotX,tf.rotY,0);
    }
    if(we)toggleAnchor();
    status("Straightened "+numWindowsS());
}
async function flattenWindows(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    let orly = new OVRTOverlay(uid);
    let tf = await orly.getTransform();
    orly.setRotation(0,tf.rotY,0);
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        data.linkedWindows[id].overlay.setRotation(0,tf.rotY,0);
    }
    if(we)toggleAnchor();
    status("Flattened "+numWindowsS());
}
async function arrangeWindows(flip){
    let lr = lockRot;
    if(lr)toggleFlat();
    if(!anchorEnabled)toggleAnchor();
    toggleAnchor();
    let overlays = [new OVRTOverlay(uid)];
    for(const id in data.linkedWindows){
        overlays.push(data.linkedWindows[id].overlay);
    }
    if(flip){
        let overlays2 = [overlays[0]];
        for(let i = overlays.length-1; i>=1; i--){
            overlays2.push(overlays[i]);
        }
        overlays = overlays2;
    }
    let origin = await overlays[0].getTransform();
    let maxSize = 0;
    for(let i = 1; i<overlays.length; i++){
        let last = overlays[i-1];
        let tf = await last.getTransform();
        let overlay = overlays[i];
        let tf2 = await overlay.getTransform();
        if(tf2.size>maxSize)maxSize = tf.size;
        overlay.setPosition(tf.posX, tf.posY, tf.posZ);
        overlay.setRotation(tf.rotX, tf.rotY, tf.rotZ);
        let r = 1;
        let f = 0;
        let rot = 0;
        if(tf.curvature>0){
            let radius = 1/(2*Math.PI*tf.curvature);
            let radians = 1/(2*radius);
            rot = radians/rad;
            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
            r = -pt[0]*2;
            f = pt[1]*2;
        }
        overlay.translateRight(r*tf.size/2);
        overlay.translateForward(-f*tf.size/2);
        r = 1;
        f = 0;
        let rot2 = 0;
        if(tf2.curvature>0){
            let radius = 1/(2*Math.PI*tf2.curvature);
            let radians = 1/(2*radius);
            rot2 = radians/rad;
            let pt = rotatePoint(0, 0, radians/rad, 0, radius);
            r = -pt[0]*2;
            f = pt[1]*2;
        }
        overlay.setRotation(tf.rotX, tf.rotY+rot, tf.rotZ);
        overlay.translateRight(r*tf2.size/2);
        overlay.translateForward(-f*tf2.size/2);
        overlay.setRotation(tf.rotX, tf.rotY+rot+rot2, tf.rotZ);
    }
    let tf = await overlays[Math.floor(overlays.length/2)].getTransform();
    overlays[0].setPosition(tf.posX, tf.posY, tf.posZ);
    overlays[0].setRotation(tf.rotX, tf.rotY, tf.rotZ);
    overlays[0].translateUp(-maxSize/2-origin.size/2);
    toggleAnchor();
    overlays[0].setPosition(origin.posX, origin.posY, origin.posZ);
    overlays[0].setRotation(origin.rotX, origin.rotY, origin.rotZ);
    if(lr)toggleFlat();
    refreshNeeded = true;
    status("Arranged "+numWindowsS());
}
async function lessCurve(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        let curve = tf.curvature-0.05;
        if(curve<0)curve = 0;
        data.linkedWindows[id].overlay.setCurve(curve);
    }
    if(we)toggleAnchor();
    status("Decreased curvature of "+numWindowsS());
}
async function moreCurve(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        let curve = tf.curvature+0.05;
        if(curve>1)curve = 1;
        data.linkedWindows[id].overlay.setCurve(curve);
    }
    if(we)toggleAnchor();
    status("Increased curvature of "+numWindowsS());
}
async function lessOpacity(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        let opacity = tf.opacity-0.05;
        if(opacity<0)opacity = 0;
        data.linkedWindows[id].overlay.setOpacity(opacity);
    }
    if(we)toggleAnchor();
    status("Decreased opacity of "+numWindowsS());
}
async function moreOpacity(){
    let we = anchorEnabled;
    if(we)toggleAnchor();
    for(const id in data.linkedWindows){
        let tf = data.linkedWindows[id].transform;
        let opacity = tf.opacity+0.05;
        if(opacity>1)opacity = 1;
        data.linkedWindows[id].overlay.setOpacity(opacity);
    }
    if(we)toggleAnchor();
    status("Increased opacity of "+numWindowsS());
}
async function toggleAnchor(updateStatus){
    if(!anchorEnabled){
        if(snapEnabled)toggleSnap();
        let tf = await new OVRTOverlay(uid).getTransform();
        for(const id in data.linkedWindows){
            let trnsfrm = await data.linkedWindows[id].overlay.getTransform();
            let origin = toQuat(tf.rotX, tf.rotY, tf.rotZ);
            let target = toQuat(trnsfrm.rotX, trnsfrm.rotY, trnsfrm.rotZ);
            data.linkedWindows[id].offset = {
                posX:trnsfrm.posX-tf.posX,
                posY:trnsfrm.posY-tf.posY,
                posZ:trnsfrm.posZ-tf.posZ,
                orgRot: origin,
                targRot: target
            };
        }
        save();
        if(wasFlat){
            anchorEnabled = !anchorEnabled;
            await toggleFlat();
            anchorEnabled = !anchorEnabled;
        }
        if(updateStatus)status("Saved "+numWindows()+" window offsets");
    }else{
        wasFlat = lockRot;
        if(lockRot){
            await toggleFlat();
            document.getElementById("toggle-flat").innerHTML = "Unlock Rotation";
        }
        if(updateStatus)status("Adjusting window offsets");
    }
    anchorEnabled = !anchorEnabled;
    save();
    document.getElementById("toggle-anchor").innerHTML = anchorEnabled?"Adjust Offsets":"Save Offsets";
}
async function toggleSnap(){
    if(anchorEnabled&&!snapEnabled){
        status("Adjust offsets before enabling snapping");
        return;
    }
    if(utility!==null){
        API.closeOverlay(utility.id);
    }
    utility = null;
    if(!snapEnabled){
        await getUtilityOverlay();
        for(const id in data.linkedWindows){
            data.linkedWindows[id].transform = await data.linkedWindows[id].overlay.getTransform();
        }
        status("Window snapping enabled");
    }else status("Window snapping disabled");
    snapEnabled = !snapEnabled;
    save();
    document.getElementById("toggle-snap").innerHTML = snapEnabled?"Disable snapping":"Enable snapping";
}
async function toggleFlat(){
    if(!lockRot){
        if(!anchorEnabled)toggleAnchor();
        lockedRot = await new OVRTOverlay(uid).getTransform();
        status("XZ Rotation locked");
    }else{
        let o = new OVRTOverlay(uid);
        let t = await o.getTransform();
        o.setRotation(lockedRot.rotX,t.rotY,lockedRot.rotZ);
        status("XZ Rotation unlocked");
    }
    lockRot = !lockRot;
    save();
    document.getElementById("toggle-flat").innerHTML = lockRot?"Unlock Rotation":"Lock rotation";
}
async function toggleLock(){
    if(!lockPos){
        if(!anchorEnabled)toggleAnchor();
        if(moveAny)toggleMove();
        status("Locked movement");
    }else status("Unlocked movement");
    lockPos = !lockPos;
    API.blockMovement(lockPos);
    save();
    document.getElementById("toggle-lock").innerHTML = lockPos?"Unlock":"Lock";
}
async function toggleMove(){
    if(!moveAny){
        if(!anchorEnabled)toggleAnchor();
        status("Enabled movement by any window");
    }else status("Locked movement to anchor only");
    moveAny = !moveAny;
    save();
    document.getElementById("toggle-move").innerHTML = moveAny?"Grab Any<br>to Move":"Grab Anchor<br>to Move";
    tooltip(moveAny?'Limit movement to anchor only':'Allow movement by any window (Unstable)');
}
function getDist(p1, p2){
    let dx = p1.posX-p2.posX;
    let dy = p1.posY-p2.posY;
    let dz = p1.posZ-p2.posZ;
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
}
async function getUtilityOverlay(transform){
    if(utility===null){
        utility = await API.spawnOverlay({
            posX: 0, 
            posY: 0, 
            posZ: 0, 
            rotX: 0, 
            rotY: 0, 
            rotZ: 0, 
            size: 0.1, 
            opacity: 0, 
            curvature: 0, 
            framerate: 5, 
            ecoMode: true, 
            lookHiding: false, 
            attachedDevice: 0, 
            shouldSave: false
        });
        status("Spawned utility overlay "+utility.id);
        utility.setBrowserOptionsEnabled(false);
        utility.setRenderingEnabled(false);
        utility.setInputBlocked(true);
        utility.setContent(0, {
            url: "utility.html",
            width: data.aspectRatio.x,
            height: data.aspectRatio.y
        });
    }
    if(transform){
        utility.setPosition(transform.posX,transform.posY,transform.posZ);
        utility.setRotation(transform.rotX,transform.rotY,transform.rotZ);
        utility.setCurve(transform.curvature);
        utility.setSize(transform.size);
    }
    return utility;
}
async function getAnchorPoints(window){
    let points = {};
    let transform = await window.overlay.getTransform();
    let overlay = await getUtilityOverlay(transform);
    let tf = await overlay.getTransform();
    let r = 1;
    let f = 0;
    let rot = 0;
    if(tf.curvature>0){
        let radius = 1/(2*Math.PI*tf.curvature);
        let radians = 1/(2*radius);
        rot = radians/rad;
        let pt = rotatePoint(0, 0, radians/rad, 0, radius);
        r = -pt[0]*2;
        f = pt[1]*2;
    }
    overlay.translateRight(r*tf.size/2);
    overlay.translateForward(-f*tf.size/2);
    let right = await overlay.getTransform();
    points.right = {
        posX: right.posX,
        posY: right.posY,
        posZ: right.posZ,
        rotX: right.rotX,
        rotY: right.rotY+rot,
        rotZ: right.rotZ
    };
    overlay.setPosition(tf.posX, tf.posY, tf.posZ);
    
    overlay.translateRight(-r*tf.size/2);
    overlay.translateForward(-f*tf.size/2);
    let left = await overlay.getTransform();
    points.left = {
        posX: left.posX,
        posY: left.posY,
        posZ: left.posZ,
        rotX: left.rotX,
        rotY: left.rotY-rot,
        rotZ: left.rotZ
    };
    overlay.setPosition(tf.posX, tf.posY, tf.posZ);
    
    overlay.translateUp(tf.size/2*data.aspectRatio.y/data.aspectRatio.x);
    let top = await overlay.getTransform();
    points.top = {
        posX: top.posX,
        posY: top.posY,
        posZ: top.posZ,
        rotX: top.rotX,
        rotY: top.rotY,
        rotZ: top.rotZ
    };
    overlay.setPosition(tf.posX, tf.posY, tf.posZ);
    
    overlay.translateUp(-tf.size/2*data.aspectRatio.y/data.aspectRatio.x);
    let bottom = await overlay.getTransform();
    points.bottom = {
        posX: bottom.posX,
        posY: bottom.posY,
        posZ: bottom.posZ,
        rotX: bottom.rotX,
        rotY: bottom.rotY,
        rotZ: bottom.rotZ
    };
    overlay.setPosition(0, 1000, 0);
    return points;
}
function switchMenu(from, to){
  document.getElementById(from).hidden = true;
  document.getElementById(to).hidden = false;
}
function updateAspectRatio(){
    document.getElementById("aspect-ratio").innerHTML = data.aspectRatio.x+":"+data.aspectRatio.y;
}
function incAspX(){
    data.aspectRatio.x++;
    updateAspectRatio();
    save();
}
function decAspX(){
    if(data.aspectRatio.x<=1)return;
    data.aspectRatio.x--;
    updateAspectRatio();
    save();
}
function incAspY(){
    data.aspectRatio.y++;
    updateAspectRatio();
    save();
}
function decAspY(){
    if(data.aspectRatio.y<=1)return;
    data.aspectRatio.y--;
    updateAspectRatio();
    save();
}
function updateLerp(){
    document.getElementById("lerp-smoothing").innerHTML = data.lerping+"%";
}
function incLerp(){
    if(data.lerping>=100)return;
    data.lerping+=5;
    updateLerp();
    save();
}
function decLerp(){
    if(data.lerping<=0)return;
    data.lerping-=5;
    updateLerp();
    save();
}
function updateMicroSmooth(){
    document.getElementById("advanced-smoothing").innerHTML = "Stabilization "+(data.microSmooth?"ON":"OFF");
}
function microSmooth(){
    document.getElementById("advanced-smoothing").innerHTML = "Stabilization "+(data.microSmooth?"ON":"OFF");
    data.microSmooth = !data.microSmooth;
    updateMicroSmooth();
    save();
}
/*
 * Quaternion functions below are modified from quaternion.js
 * MIT License
 * Copyright (c) 2017 Robert Eisele
 * https://github.com/infusion/Quaternion.js/
 */
function normQuat(q){
    let w = q.w;
    let x = q.x;
    let y = q.y;
    let z = q.z;
    let norm = Math.sqrt(w * w + x * x + y * y + z * z);

    if (norm < 1e-16) {
      return {
          w:0,
          x:0,
          y:0,
          z:0
      };
    }

    norm = 1 / norm;

    return {
        w:w*norm,
        x:x*norm,
        y:y*norm,
        z:z*norm
    };
}
function invQuat(q){
    let w = q.w;
    let x = q.x;
    let y = q.y;
    let z = q.z;
    let normSq = w*w+x*x+y*y+z*z;
    normSq = 1/normSq;
    return {
        w:w*normSq,
        x:-x*normSq,
        y:-y*normSq,
        z:-z*normSq
    };
}
function mulQuat(q0, q1){
    let w1 = q0.w;
    let x1 = q0.x;
    let y1 = q0.y;
    let z1 = q0.z;
    let w2 = q1.w;
    let x2 = q1.x;
    let y2 = q1.y;
    let z2 = q1.z;
    return {
        w:w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        x:w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        y:w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2,
        z:w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2
    };
}
function divQuat(q0, q1){
    let w1 = q0.w;
    let x1 = q0.x;
    let y1 = q0.y;
    let z1 = q0.z;
    let w2 = q1.w;
    let x2 = q1.x;
    let y2 = q1.y;
    let z2 = q1.z;
    var normSq = w2 * w2 + x2 * x2 + y2 * y2 + z2 * z2;

    if (normSq === 0) {
      return {w:0,x:0,y:0,z:0};
    }
    normSq = 1 / normSq;
    return {
        w:(w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2) * normSq,
        x:(x1 * w2 - w1 * x2 - y1 * z2 + z1 * y2) * normSq,
        y:(y1 * w2 - w1 * y2 - z1 * x2 + x1 * z2) * normSq,
        z:(z1 * w2 - w1 * z2 - x1 * y2 + y1 * x2) * normSq
    };
}
function rotVec(v, q){

    var qw = q.w;
    var qx = q.x;
    var qy = q.y;
    var qz = q.z;

    var vx = v[0];
    var vy = v[1];
    var vz = v[2];

    // t = 2q x v
    var tx = 2 * (qy * vz - qz * vy);
    var ty = 2 * (qz * vx - qx * vz);
    var tz = 2 * (qx * vy - qy * vx);

    // v + w t + q x t
    return [
      vx + qw * tx + qy * tz - qz * ty,
      vy + qw * ty + qz * tx - qx * tz,
      vz + qw * tz + qx * ty - qy * tx];
}