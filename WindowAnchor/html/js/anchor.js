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
        microSmooth: false,
        deviceOSC:{},
        oscPrefix: "/avatar/parameters/"
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
if(!data.deviceOSC){
    data.deviceOSC = {
    };
}
if(!data.oscPrefix)data.oscPrefix = "/avatar/parameters/";
document.getElementById("osc-prefix").value = data.oscPrefix;
updateAspectRatio();
updateLerp();
updateMicroSmooth();
var anchorEnabled = true;
var snapEnabled = false;
var lS = false;
var lX = false;
var lY = false;
var lZ = false;
var lRX = false;
var lRY = false;
var lRZ = false;
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
    if(data.lX||data.lY||data.lZ){
        o.setPosition(data.lockX?lockedRot.posX:selfTransform.posX,data.lY?lockedRot.PosY:selfTransform.posY,data.lZ?lockedRot.posZ:selfTransform.posZ);
    }
    if(data.lockRot||data.lRX||data.lRY||data.lRZ){
        o.setRotation(data.lockRot||data.lRX?lockedRot.rotX:selfTransform.rotX,data.lRY?lockedRot.rotY:selfTransform.rotY,data.lockRot||data.lRZ?lockedRot.rotZ:selfTransform.rotZ);
    }
    if(data.lS){
        o.setSize(data.lS?lockedRot.size:selfTransform.size);
    }
    if(data.lX)lockX();
    if(data.lY)lockY();
    if(data.lZ)lockZ();
    if(data.lRX||data.lockRot)lockRX();
    if(data.lRY)lockRY();
    if(data.lRZ||data.lockRot)lockRZ();
    if(data.lS)lockScale();
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
var updatingLoc = false;
var deviceUpdates = {};
var grabbedWindow = -1;
var utility = null;
API.on("device-position", function (event){
    deviceUpdates[event.deviceId] = event.deviceInfo;
    sendDeviceOSC(event.deviceId, event.deviceInfo);
});
API.on("message", function (event){
    let msg = event.message;
    if(msg&&msg.app==="WindowAnchor"&&msg.event==="detach"){
        detachWindow(msg.window);
    }
});
API.on("overlay-changed", async function (event){
    if(startingUp||updatingLoc)return;
    sendWindowOSC(-1, await new OVRTOverlay(uid).getTransform());
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
            let dist = Math.sqrt(dx*dx+dy*dy+dz*dz)+Math.abs(tf.size-transform.size);
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
        let sdr = Math.abs(sdrx)+Math.abs(sdry)+Math.abs(sdrz);
        let selfDist = Math.sqrt(sdx*sdx+sdy*sdy+sdz*sdz)+Math.abs(event.transform.size-selfTransform.size);
        selfTransform = {
            posX: event.transform.posX,
            posY: event.transform.posY,
            posZ: event.transform.posZ,
            rotX: event.transform.rotX,
            rotY: event.transform.rotY,
            rotZ: event.transform.rotZ,
            size: event.transform.size,
            curvature: event.transform.curvature,
            opacity: event.transform.opacity
        };
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
                if(offset.orgSize){
                    ox*=transform.size/offset.orgSize;
                    oy*=transform.size/offset.orgSize;
                    oz*=transform.size/offset.orgSize;
                }
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
                let size = fasttf.size;
                if(offset.size)size /= offset.size;
                transform.posX = posX;
                transform.posY = posY;
                transform.posZ = posZ;
                transform.rotX = transform.curvature===0?euler[0]:0;
                transform.rotY = euler[1];
                transform.rotZ = euler[2];
                updatingLoc = true;
                thees.setPosition(posX,posY,posZ);
                thees.setRotation(euler[0], euler[1], euler[2]);
                if(offset.size)thees.setSize(size);
                updatingLoc = false;
                return;
            }
            if(lX||lY||lZ){
                let d = 0;
                if(lX){
                    d += Math.abs(transform.posX-lockedRot.posX);
                    transform.posX = lockedRot.posX;
                }
                if(lY){
                    d += Math.abs(transform.posY-lockedRot.posY);
                    transform.posY = lockedRot.posY;
                }
                if(lZ){
                    d += Math.abs(transform.posZ-lockedRot.posZ);
                    transform.posZ = lockedRot.posZ;
                }
                if(d>0&&anchorMoving===false){
                    updatingLoc = true;
                    await new OVRTOverlay(uid).setPosition(transform.posX, transform.posY, transform.posZ);
                    updatingLoc = false;
                }
            }
            if(lRX||lRY||lRZ){
                let d = 0;
                if(lRX){
                    d+=Math.abs(transform.rotX-lockedRot.rotX);
                    transform.rotX = lockedRot.rotX;
                }
                if(lRY){
                    d+=Math.abs(transform.rotY-lockedRot.rotY);
                    transform.rotY = lockedRot.rotY;
                }
                if(lRZ){
                    d+=Math.abs(transform.rotZ-lockedRot.rotZ);
                    transform.rotZ = lockedRot.rotZ;
                }
                if(d>0&&anchorMoving===false){
                    updatingLoc = true;
                    await new OVRTOverlay(uid).setRotation(transform.rotX, transform.rotY, transform.rotZ);
                    updatingLoc = false;
                }
            }
            if(lS){
                let d = Math.abs(transform.size-lockedRot.size);
                transform.size = lockedRot.size;
                if(d>0&&anchorMoving===false){
                    updatingLoc = true;
                    await new OVRTOverlay(uid).setSize(transform.size);
                    updatingLoc = false;
                }
            }
            for(const wid in data.linkedWindows){
                if(moveAny&&grabbedWindow===wid)continue;
                try{
                    let thisQuat = toQuat(transform.rotX, transform.rotY, transform.rotZ);
                    let offset = data.linkedWindows[wid].offset;
                    let newRot = normalizeQuat(mulQuat(divQuat(thisQuat, offset.orgRot), offset.targRot));
                    let euler = toEuler(newRot);
                    let ox = offset.posX;
                    let oy = offset.posY;
                    let oz = offset.posZ;
                    if(offset.orgSize){
                        ox*=transform.size/offset.orgSize;
                        oy*=transform.size/offset.orgSize;
                        oz*=transform.size/offset.orgSize;
                    }
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
                    let tf = await data.linkedWindows[wid].overlay.getTransform();
                    let size = transform.size;
                    if(offset.size)size *= offset.size;
                    if(data.lerping>0||data.microSmooth){
                        let lerping = Math.max(0.1, data.lerping);
                        let amount = 1-(lerping/100);
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
                        size = lerp(tf.size, size, amount);
//                        let q1 = normalizeQuat(toQuat(tf.rotX, tf.rotY, tf.rotZ));
//                        let q3 = normalizeQuat({
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
                    sendWindowOSC(wid, {
                        posX: posX,
                        posY: posY,
                        posZ: posZ,
                        rotX: euler[0],
                        rotY: euler[1],
                        rotZ: euler[2],
                        size: tf.size,
                        curvature: tf.curvature,
                        opacity: tf.opacity
                        
                    });
                    data.linkedWindows[wid].overlay.setPosition(posX,posY,posZ);
                    data.linkedWindows[wid].overlay.setRotation(euler[0], euler[1], euler[2]);
                    if(offset.size)data.linkedWindows[wid].overlay.setSize(size);
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
    
    return normalizeQuat({
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
            targRot: target,
            size:window.transform.size/tf.size,
            orgSize:tf.size
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
    data.lX = lX;
    data.lY = lY;
    data.lZ = lZ;
    data.lRX = lRX;
    data.lRY = lRY;
    data.lRZ = lRZ;
    data.lS = lS;
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
    setTimeout(async function(){
        let orly = new OVRTOverlay(uid);
        let tf = await orly.getTransform();
        orly.setRotation(0,tf.rotY,0);
        for(const id in data.linkedWindows){
            let tf = data.linkedWindows[id].transform;
            data.linkedWindows[id].overlay.setRotation(0,tf.rotY,0);
        }
        if(we)toggleAnchor();
        status("Flattened "+numWindowsS());
    }, 1);
}
async function arrangeWindows(flip){
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
    if(overlays.length%2===1){
        let tf2 = await overlays[Math.floor(overlays.length/2)+1].getTransform();
        tf.posX += (tf2.posX-tf.posX)/2;
        tf.posY += (tf2.posY-tf.posY)/2;
        tf.posZ += (tf2.posZ-tf.posZ)/2;
        tf.rotX += (tf2.rotX-tf.rotX)/2;
        tf.rotY += (tf2.rotY-tf.rotY)/2;
        tf.rotZ += (tf2.rotZ-tf.rotZ)/2;
    }
    overlays[0].setPosition(tf.posX, tf.posY, tf.posZ);
    overlays[0].setRotation(tf.rotX, tf.rotY, tf.rotZ);
    overlays[0].translateUp(-maxSize/2-origin.size/2);
    toggleAnchor();
    overlays[0].setPosition(origin.posX, origin.posY, origin.posZ);
    overlays[0].setRotation(origin.rotX, origin.rotY, origin.rotZ);
    updateLock();
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
                targRot: target,
                size: trnsfrm.size/tf.size,
                orgSize: tf.size
            };
        }
        save();
        updateLock();
        if(updateStatus)status("Saved "+numWindows()+" window offsets");
    }else{
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
    if(!lRX||!lRZ){
        if(!anchorEnabled)toggleAnchor();
        updateLock();
        status("XZ Rotation locked");
        lRX = lRZ = true;
    }else{
        let o = new OVRTOverlay(uid);
        let t = await o.getTransform();
        o.setRotation(lockedRot.rotX,t.rotY,lockedRot.rotZ);
        status("XZ Rotation unlocked");
        lRX = lRZ = false;
    }
    save();
    document.getElementById("lock-rx").innerHTML = lRX?"Unlock Pitch":"Lock Pitch";
    document.getElementById("lock-rz").innerHTML = lRZ?"Unlock Roll":"Lock Roll";
    document.getElementById("toggle-flat").innerHTML = (lRX&&lRZ)?"Unlock Rotation":"Lock rotation";
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
//OSC STUFF
var oscCurrentWindow = 0;
var oscCurrentDevice = 1;
oscUpdateWindow();
oscUpdateDevice();
function calcLookAngle(head, window){
    let qh = toQuat(head.rotX, head.rotY, head.rotZ);
    let qw = toQuat(window.rotX, window.rotY, window.rotZ);
    let qd = divQuat(qh, qw);
    let euler = toEuler(qd);
    return Math.sqrt(euler[0]*euler[0]+euler[1]*euler[1]);//probably not right, but maybe close?
}
function sendDeviceOSC(id, info){
    let osc = data.deviceOSC[id];
    if(osc){
        sendSignedOSC(info.posX/osc.posX.range, osc.posX.text, osc.posX.type);
        sendSignedOSC(info.posY/osc.posY.range, osc.posY.text, osc.posY.type);
        sendSignedOSC(info.posZ/osc.posZ.range, osc.posZ.text, osc.posZ.type);
        sendSignedOSC(boundEuler(info.rotX)/osc.rotX.range, osc.rotX.text, osc.rotX.type);
        sendSignedOSC(boundEuler(info.rotY)/osc.rotY.range, osc.rotY.text, osc.rotY.type);
        sendSignedOSC(boundEuler(info.rotZ)/osc.rotZ.range, osc.rotZ.text, osc.rotZ.type);
        sendSignedOSC(info.trackpadX, osc.trkX.text, osc.trkX.type);
        sendSignedOSC(info.trackpadY, osc.trkY.text, osc.trkY.type);
    }
}
function sendWindowOSC(id, transform){
    let osc = data.osc;
    if(id>-1)osc = data.linkedWindows[id].osc;
    if(osc){
        sendSignedOSC(transform.posX/osc.posX.range, osc.posX.text, osc.posX.type);
        sendSignedOSC(transform.posY/osc.posY.range, osc.posY.text, osc.posY.type);
        sendSignedOSC(transform.posZ/osc.posZ.range, osc.posZ.text, osc.posZ.type);
        sendSignedOSC(boundEuler(transform.rotX)/osc.rotX.range, osc.rotX.text, osc.rotX.type);
        sendSignedOSC(boundEuler(transform.rotY)/osc.rotY.range, osc.rotY.text, osc.rotY.type);
        sendSignedOSC(boundEuler(transform.rotZ)/osc.rotZ.range, osc.rotZ.text, osc.rotZ.type);
        sendUnsignedOSC(calcLookAngle(deviceUpdates[1], transform)/osc.angle.range, osc.angle.text, osc.angle.type);
        sendUnsignedOSC(transform.size/osc.size.range, osc.size.text, osc.size.type);
        sendUnsignedOSC(transform.curvature, osc.curve.text, osc.curve.type);
        sendUnsignedOSC(transform.opacity, osc.alpha.text, osc.alpha.type);
    }
}
function boundEuler(ang){
    while(ang>180)ang-=360;
    while(ang<-180)ang+=360;
    return ang;
}
function sendSignedOSC(value, name, type){
    if(type===-1)return;
    name = data.oscPrefix+name;
    if(type===0)value = Math.floor((value+1)/2*255);//int
    if(type===2)value = value>0;
    API.sendOSCMessage(name, value+"", type);
}
function sendUnsignedOSC(value, name, type){
    if(type===-1)return;
    name = data.oscPrefix+name;
    if(type===0)value = Math.floor(value*255);//int
    if(type===2)value = value>0.5;
    API.sendOSCMessage(name, value+"", type);
}
function oscDefWindow(){
    return {
        posX:{
            text: "posX",
            type: -1,
            range: 1
        },
        posY:{
            text: "posY",
            type: -1,
            range: 1
        },
        posZ:{
            text: "posZ",
            type: -1,
            range: 1
        },
        rotX:{
            text: "rotX",
            type: -1,
            range: 180
        },
        rotY:{
            text: "rotY",
            type: -1,
            range: 180
        },
        rotZ:{
            text: "rotZ",
            type: -1,
            range: 180
        },
        angle:{
            text: "lookAngle",
            type: -1,
            range: 90
        },
        size:{
            text: "size",
            type: -1,
            range: 1
        },
        curve:{
            text: "curvature",
            type: -1
        },
        alpha:{
            text: "opacity",
            type: -1
        }
    };
}
function oscDefDevice(){
    return {
        posX:{
            text: "posX",
            type: -1,
            range: 1
        },
        posY:{
            text: "posY",
            type: -1,
            range: 1
        },
        posZ:{
            text: "posZ",
            type: -1,
            range: 1
        },
        rotX:{
            text: "rotX",
            type: -1,
            range: 180
        },
        rotY:{
            text: "rotY",
            type: -1,
            range: 180
        },
        rotZ:{
            text: "rotZ",
            type: -1,
            range: 180
        },
        trkX:{
            text: "trackpadX",
            type: -1
        },
        trkY:{
            text: "trackpadY",
            type: -1
        }
    };
}
function oscTypeS(type){
    if(type===-1)return "Off";
    if(type===0)return "Int";
    if(type===1)return "Float";
    if(type===2)return "Bool";
    return "OwO";
}
function oscPrefixChange(){
    data.oscPrefix = document.getElementById("osc-prefix").value;
    save();
}
function oscUpdateWindow(){
    let windowName = "Window";
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow===0)windowName = "This window";
    else{
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        windowName = "Window "+wid;
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    document.getElementById("osc-window").innerHTML = windowName;
    document.getElementById("osc-window-posX").value = osc.posX.text;
    document.getElementById("osc-window-posY").value = osc.posY.text;
    document.getElementById("osc-window-posZ").value = osc.posZ.text;
    document.getElementById("osc-window-rotX").value = osc.rotX.text;
    document.getElementById("osc-window-rotY").value = osc.rotY.text;
    document.getElementById("osc-window-rotZ").value = osc.rotZ.text;
    document.getElementById("osc-window-angle").value = osc.angle.text;
    document.getElementById("osc-window-size").value = osc.size.text;
    document.getElementById("osc-window-curve").value = osc.curve.text;
    document.getElementById("osc-window-alpha").value = osc.alpha.text;
    
    document.getElementById("osc-window-posx-type").innerHTML = oscTypeS(osc.posX.type);
    document.getElementById("osc-window-posy-type").innerHTML = oscTypeS(osc.posY.type);
    document.getElementById("osc-window-posz-type").innerHTML = oscTypeS(osc.posZ.type);
    document.getElementById("osc-window-rotx-type").innerHTML = oscTypeS(osc.rotX.type);
    document.getElementById("osc-window-roty-type").innerHTML = oscTypeS(osc.rotY.type);
    document.getElementById("osc-window-rotz-type").innerHTML = oscTypeS(osc.rotZ.type);
    document.getElementById("osc-window-angle-type").innerHTML = oscTypeS(osc.angle.type);
    document.getElementById("osc-window-size-type").innerHTML = oscTypeS(osc.size.type);
    document.getElementById("osc-window-curve-type").innerHTML = oscTypeS(osc.curve.type);
    document.getElementById("osc-window-alpha-type").innerHTML = oscTypeS(osc.alpha.type);
    
    document.getElementById("osc-window-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-window-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-window-posz-range").innerHTML = "±"+osc.posZ.range;
    document.getElementById("osc-window-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-window-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-window-rotz-range").innerHTML = "±"+osc.rotZ.range;
    document.getElementById("osc-window-angle-range").innerHTML = "0-"+osc.angle.range;
    document.getElementById("osc-window-size-range").innerHTML = "0-"+osc.size.range;
}
function oscPrevWindow(){
    if(oscCurrentWindow<=0)return;
    oscCurrentWindow--;
    oscUpdateWindow();
}
function oscNextWindow(){
    if(oscCurrentWindow>=Object.keys(data.linkedWindows).length)return;
    oscCurrentWindow++;
    oscUpdateWindow();
}
function oscWindowType(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    osc[key].type++;
    if(osc[key].type>=3)osc[key].type = -1;
    save();
    document.getElementById("osc-window-posx-type").innerHTML = oscTypeS(osc.posX.type);
    document.getElementById("osc-window-posy-type").innerHTML = oscTypeS(osc.posY.type);
    document.getElementById("osc-window-posz-type").innerHTML = oscTypeS(osc.posZ.type);
    document.getElementById("osc-window-rotx-type").innerHTML = oscTypeS(osc.rotX.type);
    document.getElementById("osc-window-roty-type").innerHTML = oscTypeS(osc.rotY.type);
    document.getElementById("osc-window-rotz-type").innerHTML = oscTypeS(osc.rotZ.type);
    document.getElementById("osc-window-angle-type").innerHTML = oscTypeS(osc.angle.type);
    document.getElementById("osc-window-size-type").innerHTML = oscTypeS(osc.size.type);
    document.getElementById("osc-window-curve-type").innerHTML = oscTypeS(osc.curve.type);
    document.getElementById("osc-window-alpha-type").innerHTML = oscTypeS(osc.alpha.type);
}
function oscWindowChange(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    osc[key].text = document.getElementById("osc-window-"+key).value;
    save();
}
function oscWindowPosRangeInc(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    osc[key].range++;
    save();
    document.getElementById("osc-window-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-window-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-window-posz-range").innerHTML = "±"+osc.posZ.range;
}
function oscWindowPosRangeDec(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc[key].range<=1)return;
    osc[key].range--;
    save();
    document.getElementById("osc-window-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-window-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-window-posz-range").innerHTML = "±"+osc.posZ.range;
}
function oscWindowRotRangeInc(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc[key].range>=180)return;
    osc[key].range+=90;
    save();
    document.getElementById("osc-window-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-window-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-window-rotz-range").innerHTML = "±"+osc.rotZ.range;
}
function oscWindowRotRangeDec(key){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc[key].range<=90)return;
    osc[key].range-=90;
    save();
    document.getElementById("osc-window-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-window-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-window-rotz-range").innerHTML = "±"+osc.rotZ.range;
}
function oscWindowAngleRangeInc(){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc.angle.range>=180)return;
    osc.angle.range+=5;
    save();
    document.getElementById("osc-window-angle-range").innerHTML = "0-"+osc.angle.range;
}
function oscWindowAngleRangeDec(){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc.angle.range<=5)return;
    osc.angle.range-=5;
    save();
    document.getElementById("osc-window-angle-range").innerHTML = "0-"+osc.angle.range;
}
function oscWindowSizeRangeInc(){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    osc.size.range++;
    save();
    document.getElementById("osc-window-size-range").innerHTML = "0-"+osc.size.range;
}
function oscWindowSizeRangeDec(){
    let wid = uid;
    if(!data.osc)data.osc = oscDefWindow();
    let osc = data.osc;
    if(oscCurrentWindow>0){
        wid = Object.keys(data.linkedWindows)[oscCurrentWindow-1];
        if(!data.linkedWindows[wid].osc)data.linkedWindows[wid].osc = oscDefWindow();
        osc = data.linkedWindows[wid].osc;
    }
    if(osc.size.range<=1)return;
    osc.size.range--;
    save();
    document.getElementById("osc-window-size-range").innerHTML = "0-"+osc.size.range;
}
function oscUpdateDevice(){
    let deviceName = "Device "+oscCurrentDevice;
    if(oscCurrentDevice===1)deviceName = "Headset";
    if(oscCurrentDevice===2)deviceName = "Left Controller";
    if(oscCurrentDevice===3)deviceName = "Right Controller";
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    document.getElementById("osc-device").innerHTML = deviceName;
    document.getElementById("osc-device-posX").value = osc.posX.text;
    document.getElementById("osc-device-posY").value = osc.posY.text;
    document.getElementById("osc-device-posZ").value = osc.posZ.text;
    document.getElementById("osc-device-rotX").value = osc.rotX.text;
    document.getElementById("osc-device-rotY").value = osc.rotY.text;
    document.getElementById("osc-device-rotZ").value = osc.rotZ.text;
    document.getElementById("osc-device-trkX").value = osc.trkX.text;
    document.getElementById("osc-device-trkY").value = osc.trkY.text;
    
    document.getElementById("osc-device-posx-type").innerHTML = oscTypeS(osc.posX.type);
    document.getElementById("osc-device-posy-type").innerHTML = oscTypeS(osc.posY.type);
    document.getElementById("osc-device-posz-type").innerHTML = oscTypeS(osc.posZ.type);
    document.getElementById("osc-device-rotx-type").innerHTML = oscTypeS(osc.rotX.type);
    document.getElementById("osc-device-roty-type").innerHTML = oscTypeS(osc.rotY.type);
    document.getElementById("osc-device-rotz-type").innerHTML = oscTypeS(osc.rotZ.type);
    document.getElementById("osc-device-trkx-type").innerHTML = oscTypeS(osc.trkX.type);
    document.getElementById("osc-device-trky-type").innerHTML = oscTypeS(osc.trkY.type);
    
    document.getElementById("osc-device-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-device-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-device-posz-range").innerHTML = "±"+osc.posZ.range;
    document.getElementById("osc-device-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-device-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-device-rotz-range").innerHTML = "±"+osc.rotZ.range;
}
function oscPrevDevice(){
    if(oscCurrentDevice<=1)return;
    oscCurrentDevice--;
    oscUpdateDevice();
}
function oscNextDevice(){
    oscCurrentDevice++;
    if(!deviceUpdates[oscCurrentDevice])oscCurrentDevice--;
    oscUpdateDevice();
}
function oscDeviceType(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    osc[key].type++;
    if(osc[key].type>=3)osc[key].type = -1;
    save();
    document.getElementById("osc-device-posx-type").innerHTML = oscTypeS(osc.posX.type);
    document.getElementById("osc-device-posy-type").innerHTML = oscTypeS(osc.posY.type);
    document.getElementById("osc-device-posz-type").innerHTML = oscTypeS(osc.posZ.type);
    document.getElementById("osc-device-rotx-type").innerHTML = oscTypeS(osc.rotX.type);
    document.getElementById("osc-device-roty-type").innerHTML = oscTypeS(osc.rotY.type);
    document.getElementById("osc-device-rotz-type").innerHTML = oscTypeS(osc.rotZ.type);
    document.getElementById("osc-device-trkx-type").innerHTML = oscTypeS(osc.trkX.type);
    document.getElementById("osc-device-trky-type").innerHTML = oscTypeS(osc.trkY.type);
}
function oscDeviceChange(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    osc[key].text = document.getElementById("osc-device-"+key).value;
    save();
}
function oscDevicePosRangeInc(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    osc[key].range++;
    save();
    document.getElementById("osc-device-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-device-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-device-posz-range").innerHTML = "±"+osc.posZ.range;
}
function oscDevicePosRangeDec(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    if(osc[key].range<=1)return;
    osc[key].range--;
    save();
    document.getElementById("osc-device-posx-range").innerHTML = "±"+osc.posX.range;
    document.getElementById("osc-device-posy-range").innerHTML = "±"+osc.posY.range;
    document.getElementById("osc-device-posz-range").innerHTML = "±"+osc.posZ.range;
}
function oscDeviceRotRangeInc(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    if(osc[key].range>=180)return;
    osc[key].range+=90;
    save();
    document.getElementById("osc-device-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-device-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-device-rotz-range").innerHTML = "±"+osc.rotZ.range;
}
function oscDeviceRotRangeDec(key){
    if(!data.deviceOSC[oscCurrentDevice]) data.deviceOSC[oscCurrentDevice] = oscDefDevice();
    let osc = data.deviceOSC[oscCurrentDevice];
    if(osc[key].range<=90)return;
    osc[key].range-=90;
    save();
    document.getElementById("osc-device-rotx-range").innerHTML = "±"+osc.rotX.range;
    document.getElementById("osc-device-roty-range").innerHTML = "±"+osc.rotY.range;
    document.getElementById("osc-device-rotz-range").innerHTML = "±"+osc.rotZ.range;
}
function lockScale(){
    lS = !lS;
    document.getElementById("lock-scale").innerHTML = lS?"Unlock Scale":"Lock Scale";
    updateLock();
}
function lockX(){
    lX = !lX;
    document.getElementById("lock-x").innerHTML = lX?"Unlock X Position":"Lock X Position";
    updateLock();
}
function lockY(){
    lY = !lY;
    document.getElementById("lock-y").innerHTML = lY?"Unlock Y Position":"Lock Y Position";
    updateLock();
}
function lockZ(){
    lZ = !lZ;
    document.getElementById("lock-z").innerHTML = lZ?"Unlock Z Position":"Lock Z Position";
    updateLock();
}
function lockRX(){
    lRX = !lRX;
    document.getElementById("lock-rx").innerHTML = lRX?"Unlock Pitch":"Lock Pitch";
    updateLock();
}
function lockRY(){
    lRY = !lRY;
    document.getElementById("lock-ry").innerHTML = lRY?"Unlock Yaw":"Lock Yaw";
    updateLock();
}
function lockRZ(){
    lRZ = !lRZ;
    document.getElementById("lock-rz").innerHTML = lRZ?"Unlock Roll":"Lock Roll";
    updateLock();
}
async function updateLock(){
    lockedRot = await new OVRTOverlay(uid).getTransform();
}
/*
 * Quaternion functions below are modified from quaternion.js
 * MIT License
 * Copyright (c) 2017 Robert Eisele
 * https://github.com/infusion/Quaternion.js/
 */
function normalizeQuat(q){
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
function normQuat(q){
    let w = q.w;
    let x = q.x;
    let y = q.y;
    let z = q.z;
    return Math.sqrt(w * w + x * x + y * y + z * z);
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