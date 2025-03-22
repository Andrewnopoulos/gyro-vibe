# MAGE FIGHT

A web application that uses WebSockets to connect a mobile device to a PC and transmits gyroscope and accelerometer data in real-time.

## Features

- Real-time connection between mobile device and PC using WebSockets
- Access to mobile device gyroscope and accelerometer data
- Visual representation of sensor data on the PC client
- QR code for easy mobile device connection
- Support for iOS motion permission requirements
- Real-time data visualization with graphs

## Prerequisites

- Node.js (v14+)
- A mobile device with gyroscope and accelerometer sensors
- Both devices on the same network (for local development)

## Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/gyro-vibe.git
   cd gyro-vibe
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the server
   ```
   npm start
   ```

4. For development with auto-restart:
   ```
   npm run dev
   ```

## Usage

1. Start the server using one of the commands above
2. Open a web browser on your PC and navigate to `http://localhost:3000`
3. On your mobile device:
   - Scan the QR code displayed on the PC client, or
   - **IMPORTANT:** Use the HTTPS URL for sensor access: `https://<your-local-ip>:3443/mobile`
   - Note: Replace `<your-local-ip>` with your computer's IP address on the local network
4. Accept the security warning about the self-signed certificate (click "Advanced" then "Proceed")
5. Press "Start Sensors" on the mobile device
6. Move your mobile device around to see the gyroscope and accelerometer data change in real-time on the PC client

## Notes on Mobile Browser Compatibility

- **HTTPS Requirement**: Modern browsers require HTTPS to access device sensors. When connecting from a mobile device, use the HTTPS URL (`https://<your-local-ip>:3443/mobile`).
- **Self-signed Certificate**: The app uses a self-signed certificate for HTTPS. You'll need to accept the security warning in your browser.
- **iOS (Safari)**: Starting from iOS 13, you need to grant permission to access device motion and orientation data. The app will prompt for this permission when you click "Start Sensors".
- **Android (Chrome)**: Most modern Android devices should work without any special permission, but the device needs to have gyroscope and accelerometer sensors.

## Troubleshooting

See the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) file for detailed solutions to common issues.

## Network Requirements

For local development, when connecting the mobile device to the PC:
1. Both devices must be on the same network
2. The PC's firewall must allow connections on the port used by the server (default: 3000)
3. For external access, you'll need to configure port forwarding on your router

## Deployment

### Railway Deployment

This application is configured for easy deployment on Railway:

1. Create a Railway account and install the Railway CLI:
   ```
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```
   railway login
   ```

3. Link your repository:
   ```
   railway link
   ```

4. Deploy your app:
   ```
   railway up
   ```

Alternatively, you can connect your GitHub repository directly in the Railway dashboard for automatic deployments.

The application is already configured to detect when it's running on Railway and will automatically:
- Use proper HTTPS settings provided by Railway
- Generate correct QR codes with the public URL
- Use the PORT environment variable provided by Railway

## Customization

- Edit the server configuration in `server/index.js`
- Modify the PC client interface in `client/index.html` and `client/js/client.js`
- Customize the mobile client in `client/mobile.html`

## License

ISC