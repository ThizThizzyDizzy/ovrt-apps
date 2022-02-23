const API = new OVRT();
window.addEventListener("api-ready", () => {
    API.setCurrentBrowserTitle("Attached Indicator");
    API.blockMovement(true);
    const duration = 200;//ms
    const frameTime = 10;//ms
    API.getUniqueID().then(id => {
        new OVRTOverlay(id).setInputBlocked(true);
        for(let i = 0; i<duration/frameTime; i++){
            setTimeout(() => {
                document.body.style.background = "rgba(63, 255, 71, "+(1-(i/(duration/frameTime)))+")";
            }, i*frameTime);
        }
        setTimeout(() => {
            API.closeOverlay(id);
        }, duration);
    });
});