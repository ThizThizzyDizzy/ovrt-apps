const API = new OVRT({
    "function_queue": true
});
API.blockMovement(true);
API.setCurrentBrowserTitle("PhysicalUI");
API.getUniqueID().then(id => {
    let overlay = new OVRTOverlay(id);
    overlay.setRenderingEnabled(false);
    overlay.setInputBlocked(true);
});
var devices = {};
API.on("device-position", function(event){
    try{
        devices[event.deviceId] = event.deviceInfo;
    }catch(err){
        console.error(err);
    }
});
API.on("overlay-changed", async function (event){
    refresh();
});
var timer = setInterval(update, 10);
var leftHeld = {
    held : false,
    window : -1, //window id
    point: -1 //0 is left, 1 is right
};
var rightHeld = {
    held : false,
    window : -1, //window id
    point: -1 //0 is left, 1 is right
};
var grabDist = 0.1;
async function update(){
    if(devices[1]){
        if(devices[1].windowMoveDown===false){
            leftHeld.held = false;
        }
        let closest = -1;
        let closestSide = -1;
        let closestDist = 0;
        let tf = devices[1];
        for(const wid in windows){
            let window = windows[wid];
            let left = window.points.left;
            let right = window.points.right;
            let ldist = dist(tf.posX,tf.posY,tf.posZ, left.posX, left.posY, left.posZ);
            let rdist = dist(tf.posX,tf.posY,tf.posZ, right.posX, right.posY, right.posZ);
            if(ldist<=grabDist&&(ldist<closestDist||closest===-1)){
                closest = wid;
                closestDist = ldist;
                closestSide = 0;
            }
            if(rdist<=grabDist&&(rdist<closestDist||closest===-1)){
                closest = wid;
                closestDist = rdist;
                closestSide = 1;
            }
        }
        if(leftHeld.held===false){
            leftHeld.window = closest;
            leftHeld.point = closestSide;
            if(closest!==-1){
                let window = windows[closest];
                let left = window.points.left;
                let right = window.points.right;
                leftHeld.scalar = dist(left.posX,left.posY,left.posZ,right.posX,right.posY,right.posZ);
                let origin = toQuat(tf.rotX, tf.rotY, tf.rotZ);
                let target = toQuat(window.transform.rotX, window.transform.rotY, window.transform.rotZ);
                leftHeld.offset = {
                    posX:window.transform.posX-tf.posX,
                    posY:window.transform.posY-tf.posY,
                    posZ:window.transform.posZ-tf.posZ,
                    orgRot: origin,
                    targRot: target
                };
            }
        }
        if(devices[1].windowMoveDown===true&&leftHeld.window!==-1){
            leftHeld.held = true;
        }
    }
    if(devices[2]){
        if(devices[2].windowMoveDown===false){
            rightHeld.held = false;
        }
        let closest = -1;
        let closestSide = -1;
        let closestDist = 0;
        let tf = devices[2];
        for(const wid in windows){
            let window = windows[wid];
            let left = window.points.left;
            let right = window.points.right;
            let ldist = dist(tf.posX,tf.posY,tf.posZ, left.posX, left.posY, left.posZ);
            let rdist = dist(tf.posX,tf.posY,tf.posZ, right.posX, right.posY, right.posZ);
            if(ldist<=grabDist&&(ldist<closestDist||closest===-1)){
                closest = wid;
                closestDist = ldist;
                closestSide = 0;
            }
            if(rdist<=grabDist&&(rdist<closestDist||closest===-1)){
                closest = wid;
                closestDist = rdist;
                closestSide = 1;
            }
        }
        if(rightHeld.held===false){
            rightHeld.window = closest;
            rightHeld.point = closestSide;
            if(closest!==-1){
                let window = windows[closest];
                let left = window.points.left;
                let right = window.points.right;
                rightHeld.scalar = dist(left.posX,left.posY,left.posZ,right.posX,right.posY,right.posZ);
                let origin = toQuat(tf.rotX, tf.rotY, tf.rotZ);
                let target = toQuat(window.transform.rotX, window.transform.rotY, window.transform.rotZ);
                rightHeld.offset = {
                    posX:window.transform.posX-tf.posX,
                    posY:window.transform.posY-tf.posY,
                    posZ:window.transform.posZ-tf.posZ,
                    orgRot: origin,
                    targRot: target
                };
            }
        }
        if(devices[2].windowMoveDown===true&&rightHeld.window!==-1){
            rightHeld.held = true;
        }
    }
    if(leftHeld.held===true){
        let wid = leftHeld.window;
        let window = windows[wid];
        let transform = devices[1];
        try{
            let overlay = new OVRTOverlay(wid);
            let thisQuat = toQuat(transform.rotX, transform.rotY, transform.rotZ);
            let offset = leftHeld.offset;
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
            let tf = await overlay.getTransform();
            overlay.setPosition(posX,posY,posZ);
            overlay.setRotation(euler[0], euler[1], euler[2]);
        }catch(err){}
    }
    if(rightHeld.held===true){
        
    }
}
function dist(x1,y1,z1,x2,y2,z2){
    let x = x1-x2;
    let y = y1-y2;
    let z = z1-z2;
    return Math.sqrt(x*x+y*y+z*z);
}
var windows = {};
async function refresh(){
    windows = {};
    let overlays = JSON.parse(await API.getOverlays());
    for(const id of overlays){
        let overlay = new OVRTOverlay(id);
        let transform = await overlay.getTransform();
        windows[id] = {
            overlay: overlay,
            transform: transform,
            points: await getAnchorPoints(overlay)
        };
    }
}
var utility = null;
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
            width: 1,
            height: 1
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
rad = Math.PI/180;
async function getAnchorPoints(window){
    let points = {};
    let transform = await window.getTransform();
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
    overlay.setPosition(0, 1000, 0);
    return points;
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
function rotatePoint(px, py, ang, ox, oy){
    let x = px-ox, y = py-oy;
    let s = Math.sin(ang*rad);
    let c = Math.cos(ang*rad);
    return [c*x+s*y+ox, c*y-s*x+oy];
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