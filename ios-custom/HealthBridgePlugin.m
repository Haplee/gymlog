#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// ObjC bridge registering HealthBridgePlugin with the Capacitor runtime, so
// registerPlugin('HealthBridge') in JS resolves on iOS. jsName = "HealthBridge".
CAP_PLUGIN(HealthBridgePlugin, "HealthBridge",
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestAuthorization, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(readAll, CAPPluginReturnPromise);
)
