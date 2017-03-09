import * as winston from 'winston';
winston.addColors({
    info: 'green',
    warn: 'yellow',
    error: 'red'
})
export const logger = new winston.Logger({
    level: 'info',
    
    transports: [
        new (winston.transports.Console)({
            colorize: true,
            showLevel: false,
            label: 'typescript'
        }),
    ]
});