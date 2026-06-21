#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// ObjC bridge registering BiometricPlugin and its 3 methods with the Capacitor
// runtime. Required so registerPlugin('BiometricPlugin') in JS resolves on iOS.
CAP_PLUGIN(BiometricPlugin, "BiometricPlugin",
    CAP_PLUGIN_METHOD(checkBiometry, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(authenticate, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setBiometricEnabled, CAPPluginReturnPromise);
)
