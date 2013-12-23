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
    //TODO: if null ask for pass;
    pass: null,
    gitUser: null,
    checkBeforSend: false,
    addDescription : false

};
