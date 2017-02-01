// ==UserScript==
// @name         YT ratio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Stores visited video likes / dislikes ratios and creates browsable rankings.
// @author       Flagoul
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function fetchValues() {
        let values = document.querySelectorAll(".like-button-renderer > span:nth-of-type(odd) button span");
        let likes = parseInt(values[0].textContent.replace(/\s+/g, ""));
        let dislikes = parseInt(values[1].textContent.replace(/\s+/g, ""));

        return {
            "views": parseInt(document.querySelector(".watch-view-count").textContent.split(/\s+/).slice(0, -1).join("")),
            "likes": likes,
            "dislikes": dislikes,
            "ratio": likes/dislikes,
            "url": values[0].baseURI
        };
    }

    console.log(fetchValues());
})();