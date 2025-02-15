const DEBUG_EVENTS = [
    'chat',
    'entityHurt',
    'entitySwingArm',
    'entityMoved'
];
export function debugLog(eventName, message, data) {
    if (DEBUG_EVENTS.includes(eventName)) {
        console.log(`\n--- ${eventName} Event ---`);
        console.log(message);
        if (data)
            console.log(data);
        console.log('Timestamp:', new Date().toISOString());
    }
}
