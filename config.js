/**
 * @fileOverview
 * @name config.js
 * @author piecyk
 * @license 
 */

module.exports = {
    
    //for content of this conf contact  piecyk [ at ] gmail.com
    projects: [
        {name: null, id: null}
    ],
    hours : 8,
    url : {
        login: null,
        plan : null,
        hours: null,
        add : null,
        delete: null
    },
    defaultTask: 'I was working on : ',
    defaultDesc: '',
    user: null,
    //don't store plain text password, only on encrypted partition
    //TODO: if null ask for pass;
    pass: null,

    git: {
        user: null,
        repos : [
            { id: null, path : null }
        ]
    },
    jira: {
        user: null,
        pass: null,
        url: null
    },    
    randomTask: 'refactoring, update test and ui-tweaks'

    //TDOD:
    // add support for svn
};
