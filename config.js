/**
 * @fileOverview
 * @name config.js
 * @author piecyk
 * @license 
 */

module.exports = {
    
    //for content of this conf contact  piecyk [ at ] gmail.com

    projects: [
        {
            id : null,
            hours : 8,
            repos : [ 
                { id: null, path : null }
            ]
        }
    ],
    url : {
        login: null,
        reports : null,
        logTo : null
    },
    startOfMsg: 'I was working on : ',
    randomMsg: 'refactoring, update test and ui-tweaks',
    user: null,
    //don't store plain text password, only on encrypted partition
    //if null you will be asked for pass;
    pass: null,
    gitUser: null,
    //TODO: now it always ask for check
    checkBeforSend: false,
    //TODO: add this
    addDescription : false
};
