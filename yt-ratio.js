// ==UserScript==
// @name         YT ratio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Stores visited video likes / dislikes ratios and creates browsable rankings.
// @author       Flagoul
// @match        https://www.youtube.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    function fetchValues() {
        let values = document.querySelectorAll(".like-button-renderer > span:nth-of-type(odd) button span");

        if (values.length === 0) {
            return null;
        }

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

    function displayRatioAndSaveValues() {
        let values = fetchValues();
        if (values !== null) {
            console.log("values:");
            console.log(values);

            GM_addStyle(`
                .ratio-icon:before {
                    margin-right: 4px !important;
                    opacity: 1 !important;
                    margin-bottom: 3px !important;
                }
            `);

            let ratioValue = document.createElement("span");
            ratioValue.classList.add("yt-uix-button-content");
            ratioValue.appendChild(document.createTextNode(values.ratio.toFixed(2)));

            let button = document.createElement("button");
            button.classList.add("yt-uix-button", "yt-uix-button-opacity", "yt-ui-menu-item", "has-icon", "action-panel-trigger-stats", "ratio-icon");
            button.appendChild(ratioValue);
            button.style.width = "inherit";

            let ratio = document.createElement("span");
            ratio.appendChild(button);
            ratio.setAttribute("title", "Ratio likes / dislikes");

            document.querySelector(".like-button-renderer").appendChild(ratio);
        }
    }

    displayRatioAndSaveValues();

    window.addEventListener("spfdone", function(e) {
        displayRatioAndSaveValues();
    });
})();