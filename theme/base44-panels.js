/**
 * Base44 floating sidebar panels for the Node-RED editor.
 *
 * Loaded through editorTheme.page.scripts (see docker-compose.base44.yml).
 *
 * Popping a panel out only moves that section's content element into a
 * floating shell over the canvas - the panel stays Node-RED's own DOM, so
 * tabs, the palette filter, node drag-and-drop and every other behaviour keep
 * working. The docked section keeps its title strip, which docks it back.
 */
(function () {
    'use strict';

    var MARGIN = 8;
    var DRAG_THRESHOLD = 5;

    function headerBottom() {
        var header = document.getElementById('red-ui-header');
        return header ? header.getBoundingClientRect().bottom : 0;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }

    function sections() {
        var sidebar = document.getElementById('red-ui-sidebar-left');
        if (!sidebar) { return []; }
        return Array.prototype.slice.call(sidebar.children).filter(function (el) {
            return el.classList && el.classList.contains('red-ui-sidebar-section');
        });
    }

    function remember(section) {
        if (section.b44Style === undefined) {
            section.b44Style = section.getAttribute('style') || '';
        }
    }

    function restore(section) {
        if (section.b44Style !== undefined) {
            section.setAttribute('style', section.b44Style);
            delete section.b44Style;
        }
    }

    function place(panel, x, y) {
        var width = panel.offsetWidth;
        var height = panel.offsetHeight;
        panel.style.left = Math.round(clamp(x, MARGIN, window.innerWidth - width - MARGIN)) + 'px';
        panel.style.top = Math.round(clamp(y, headerBottom() + MARGIN, window.innerHeight - height - MARGIN)) + 'px';
    }

    function drag(panel, event, offsetX, offsetY) {
        var pointerId = event.pointerId;
        function move(ev) {
            if (pointerId !== undefined && ev.pointerId !== undefined && ev.pointerId !== pointerId) { return; }
            place(panel, ev.clientX - offsetX, ev.clientY - offsetY);
        }
        function stop() {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            panel.classList.remove('b44-dragging');
        }
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        panel.classList.add('b44-dragging');
        place(panel, event.clientX - offsetX, event.clientY - offsetY);
    }

    function dock(section) {
        var panel = section.b44Panel;
        if (!panel) { return; }
        var content = panel.querySelector('.red-ui-sidebar-content');
        var footer = panel.querySelector('.red-ui-sidebar-footer');
        var banner = section.querySelector('.red-ui-sidebar-banner');
        if (content) { section.insertBefore(content, banner ? banner.nextSibling : null); }
        if (footer) { section.appendChild(footer); }
        if (panel.b44TitleObserver) { panel.b44TitleObserver.disconnect(); }
        panel.remove();
        delete section.b44Panel;
        section.classList.remove('b44-floating');
        restore(section);
        try { window.jQuery(section).draggable('enable'); } catch (err) { /* not draggable */ }
        if (!sections().some(function (other) { return other.b44Panel; })) {
            sections().forEach(restore);
        }
    }

    function popOut(section) {
        if (section.b44Panel) { return section.b44Panel; }
        var content = section.querySelector('.red-ui-sidebar-content');
        if (!content) { return null; }
        var footer = section.querySelector('.red-ui-sidebar-footer');
        var rect = section.getBoundingClientRect();

        var panel = document.createElement('div');
        panel.className = 'b44-float-panel';
        panel.style.width = Math.round(rect.width) + 'px';
        panel.style.height = Math.round(Math.max(rect.height, 260)) + 'px';

        var bar = document.createElement('div');
        bar.className = 'b44-float-titlebar';
        var title = document.createElement('span');
        title.className = 'b44-float-title';
        bar.appendChild(title);

        var dockButton = document.createElement('button');
        dockButton.type = 'button';
        dockButton.className = 'b44-float-dock';
        dockButton.title = 'Dock panel back';
        dockButton.setAttribute('aria-label', 'Dock panel back');
        dockButton.innerHTML = '<i class="fa fa-thumb-tack"></i>';
        bar.appendChild(dockButton);

        panel.appendChild(bar);
        panel.appendChild(content);
        if (footer) { panel.appendChild(footer); }
        document.getElementById('red-ui-editor').appendChild(panel);

        var bannerLabel = section.querySelector('.red-ui-sidebar-banner-label');
        function syncTitle() {
            var text = bannerLabel ? bannerLabel.textContent.trim() : '';
            title.textContent = text || 'Panel';
        }
        syncTitle();
        if (bannerLabel && window.MutationObserver) {
            panel.b44TitleObserver = new MutationObserver(syncTitle);
            panel.b44TitleObserver.observe(bannerLabel, { childList: true, characterData: true, subtree: true });
        }

        dockButton.addEventListener('click', function (ev) {
            ev.preventDefault();
            dock(section);
        });

        bar.addEventListener('pointerdown', function (ev) {
            if (ev.button !== 0 || ev.target.closest('button')) { return; }
            ev.preventDefault();
            var box = panel.getBoundingClientRect();
            drag(panel, ev, ev.clientX - box.left, ev.clientY - box.top);
        });

        remember(section);
        section.b44Panel = panel;
        section.classList.add('b44-floating');
        section.style.height = 'auto';
        section.style.flexGrow = '0';
        section.style.minHeight = '0';

        var sibling = sections().filter(function (other) { return other !== section; })[0];
        if (sibling && !sibling.b44Panel) {
            remember(sibling);
            sibling.style.flexGrow = '1';
            sibling.style.height = 'auto';
        }
        try { window.jQuery(section).draggable('disable'); } catch (err) { /* not draggable */ }

        place(panel, rect.right + 12, rect.top);
        return panel;
    }

    function addToggle(section) {
        var tools = section.querySelector('.red-ui-sidebar-banner-tools');
        if (!tools || tools.querySelector('.b44-float-toggle')) { return; }
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'b44-float-toggle';
        button.title = 'Pop out panel';
        button.setAttribute('aria-label', 'Pop out panel');
        button.innerHTML = '<i class="fa fa-external-link"></i>';
        /* Keep Node-RED's own sidebar drag (handle: .red-ui-sidebar-banner) out of it */
        button.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
        button.addEventListener('pointerdown', function (ev) {
            if (ev.button !== 0) { return; }
            ev.preventDefault();
            ev.stopPropagation();
            var panel = null;
            var offsetX = 60;
            var offsetY = 16;
            function move(e) {
                if (!panel) {
                    if (Math.hypot(e.clientX - ev.clientX, e.clientY - ev.clientY) < DRAG_THRESHOLD) { return; }
                    panel = popOut(section);
                    if (!panel) { return; }
                    panel.classList.add('b44-dragging');
                }
                place(panel, e.clientX - offsetX, e.clientY - offsetY);
            }
            function stop() {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
                if (panel) {
                    panel.classList.remove('b44-dragging');
                } else if (section.b44Panel) {
                    dock(section);
                } else {
                    popOut(section);
                }
            }
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop);
        });
        tools.appendChild(button);
    }

    function enhance() {
        sections().forEach(function (section) {
            if (!section.b44Panel) { addToggle(section); }
        });
    }

    function init() {
        enhance();
        var sidebar = document.getElementById('red-ui-sidebar-left');
        if (sidebar && window.MutationObserver) {
            new MutationObserver(enhance).observe(sidebar, { childList: true });
        }
        window.addEventListener('resize', function () {
            sections().forEach(function (section) {
                var panel = section.b44Panel;
                if (!panel) { return; }
                place(panel, parseFloat(panel.style.left) || 0, parseFloat(panel.style.top) || 0);
            });
        });
    }

    if (document.getElementById('red-ui-sidebar-left')) {
        init();
    } else if (window.MutationObserver) {
        var observer = new MutationObserver(function () {
            if (document.getElementById('red-ui-sidebar-left')) {
                observer.disconnect();
                init();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
