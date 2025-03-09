# Troubleshooting Guide for Gyro-Vibe

This guide will help you solve common issues when using the Gyro-Vibe application.

## No Sensor Data from Mobile Device

### 1. HTTPS Connection Required

Most modern browsers require HTTPS connections to access device sensors. If your mobile device is not sending sensor data:

1. **Use the HTTPS URL**: Access your mobile client using the HTTPS URL shown in the QR code section:
   ```
   https://<your-ip>:3443/mobile
   ```

2. **Accept Security Warning**: Since we're using a self-signed certificate, your browser will show a security warning. Click "Advanced" and then "Proceed to site" (wording may vary by browser).

3. **Verify HTTPS Connection**: In the mobile client's connection info section, check that "URL protocol: https:" is displayed.

### 2. Device Permissions

Some devices (especially iOS) require explicit permissions:

1. **iOS Devices**: When you press "Start Sensors", you should get permission prompts. Accept these prompts.

2. **Check Browser Support**: Not all browsers support device orientation/motion events. Chrome, Safari, and Firefox on modern devices generally have good support.

3. **Check Connection Info**: After pressing "Start Sensors", the Connection Info section should show detailed diagnostic information about sensor availability.

### 3. Device Capability

Not all devices have gyroscope and accelerometer sensors:

1. **Check Device Specs**: Verify that your mobile device actually has the required sensors.

2. **Test with Known Device**: Try with a different device that you know has these sensors.

## Connection Issues

### 1. Network Connectivity

Both devices must be on the same network:

1. **Check Wi-Fi**: Ensure both your PC and mobile device are connected to the same Wi-Fi network.

2. **Firewall Settings**: Make sure your firewall allows connections on ports 3000 (HTTP) and 3443 (HTTPS).

3. **Try Localhost**: If testing on the same device, use `localhost` instead of the IP address.

### 2. Server Issues

If the server isn't running correctly:

1. **Check Server Logs**: Look for any error messages when starting the server.

2. **Restart Server**: Stop and restart the server using `npm start`.

3. **Port Conflicts**: If ports 3000 or 3443 are already in use, change them in the server code.

## Browser Compatibility Issues

Different browsers have different levels of support for the necessary APIs:

1. **Chrome on Android**: Generally has good support for sensor APIs.

2. **Safari on iOS**: Requires permission requests and HTTPS.

3. **Desktop Browsers**: Most desktop browsers don't have access to gyroscope/accelerometer (unless on a laptop with such sensors).

## Certificate Issues

When using HTTPS with self-signed certificates:

1. **Certificate Warning**: You'll see a security warning in the browser - this is normal with self-signed certificates.

2. **Accept Risk**: You need to click through the warning to proceed to the site.

3. **Renew Certificate**: If the certificate expires, regenerate it with the OpenSSL command.

## Debugging

For detailed debugging:

1. **Browser Dev Tools**: Open the browser's developer tools (F12 or Ctrl+Shift+I) to see any JavaScript errors.

2. **Connection Info Panel**: Check the Connection Info panel on the mobile device for detailed sensor availability information.

3. **Server Logs**: Watch the server console for connection events and any errors.

## Known Browser Limitations

- **iOS Safari**: Requires user interaction (like a button press) before granting sensor access.
- **Firefox on some Android devices**: May have limited sensor support.
- **Most browsers on HTTP**: Will not allow access to sensor data without HTTPS.
- **Older devices/browsers**: May not support the required APIs at all.