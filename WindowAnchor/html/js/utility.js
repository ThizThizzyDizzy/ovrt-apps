const API = new OVRT({
    "function_queue": true
});
API.setCurrentBrowserTitle("Anchor Utility Overlay");
API.blockMovement(true);
API.getUniqueID().then(id => {
    new OVRTOverlay(id).setInputBlocked(true);
});