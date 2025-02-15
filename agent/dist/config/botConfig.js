export function createBotConfig(isOnline, serverPort) {
    const baseConfig = {
        host: 'localhost',
        port: serverPort,
        username: 'JunkoEnoshima',
        version: '1.21.4',
    };
    if (isOnline) {
        return {
            ...baseConfig,
            host: 'birthday-9VFN.aternos.me',
            username: 'Dainsleif',
            auth: 'microsoft',
            flow: 'msal',
            clientId: "00000000402b5328",
            onMsaCode: (data) => {
                console.log('To sign in, use a web browser to open the page https://www.microsoft.com/link and enter the code:', data.user_code);
            },
            tokenStorage: null
        };
    }
    return baseConfig;
}
