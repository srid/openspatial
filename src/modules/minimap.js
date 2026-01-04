export class MinimapManager {
    constructor(canvasManager, spaceWidth, spaceHeight) {
        this.canvas = canvasManager;
        this.spaceWidth = spaceWidth;
        this.spaceHeight = spaceHeight;
        this.minimapSize = 180;
        this.scale = this.minimapSize / Math.max(spaceWidth, spaceHeight);
        this.element = null;
        this.viewportRect = null;
        this.dotsContainer = null;
        this.isDragging = false;
    }
    
    init() {
        this.createMinimapElement();
        this.setupEvents();
        this.startUpdating();
    }
    
    createMinimapElement() {
        this.element = document.createElement('div');
        this.element.className = 'minimap';
        this.element.innerHTML = `
            <div class="minimap-content">
                <div class="minimap-viewport"></div>
                <div class="minimap-dots"></div>
            </div>
        `;
        
        document.getElementById('canvas-container').appendChild(this.element);
        this.viewportRect = this.element.querySelector('.minimap-viewport');
        this.dotsContainer = this.element.querySelector('.minimap-dots');
    }
    
    setupEvents() {
        const content = this.element.querySelector('.minimap-content');
        
        content.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isDragging = true;
            this.panToMinimapPosition(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.panToMinimapPosition(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
    }
    
    panToMinimapPosition(e) {
        const rect = this.element.querySelector('.minimap-content').getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        // Clamp to space bounds
        const clampedX = Math.max(0, Math.min(this.spaceWidth, x));
        const clampedY = Math.max(0, Math.min(this.spaceHeight, y));
        
        this.canvas.centerOn(clampedX, clampedY);
    }
    
    startUpdating() {
        const update = () => {
            this.updateViewport();
            this.updateDots();
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
    
    updateViewport() {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        
        // Calculate visible area in space coordinates
        const topLeft = this.canvas.screenToSpace(0, 0);
        const bottomRight = this.canvas.screenToSpace(containerRect.width, containerRect.height);
        
        const left = Math.max(0, topLeft.x) * this.scale;
        const top = Math.max(0, topLeft.y) * this.scale;
        const width = Math.min(this.spaceWidth, bottomRight.x - topLeft.x) * this.scale;
        const height = Math.min(this.spaceHeight, bottomRight.y - topLeft.y) * this.scale;
        
        this.viewportRect.style.left = `${left}px`;
        this.viewportRect.style.top = `${top}px`;
        this.viewportRect.style.width = `${Math.max(10, width)}px`;
        this.viewportRect.style.height = `${Math.max(10, height)}px`;
    }
    
    updateDots() {
        // Get all avatars and screen shares
        const avatars = document.querySelectorAll('.avatar');
        const screenShares = document.querySelectorAll('.screen-share');
        
        // Clear existing dots
        this.dotsContainer.innerHTML = '';
        
        // Add avatar dots (blue)
        avatars.forEach(avatar => {
            const left = parseInt(avatar.style.left) || 0;
            const top = parseInt(avatar.style.top) || 0;
            // Avatar center (avatar is 120px, offset by 60 in avatar.js)
            const x = (left + 60) * this.scale;
            const y = (top + 60) * this.scale;
            
            const dot = document.createElement('div');
            dot.className = 'minimap-dot minimap-dot-avatar';
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
            this.dotsContainer.appendChild(dot);
        });
        
        // Add screen share dots (green rectangles)
        screenShares.forEach(share => {
            const left = parseInt(share.style.left) || 0;
            const top = parseInt(share.style.top) || 0;
            const width = parseInt(share.style.width) || 480;
            const height = parseInt(share.style.height) || 320;
            
            const x = left * this.scale;
            const y = top * this.scale;
            const w = Math.max(4, width * this.scale);
            const h = Math.max(3, height * this.scale);
            
            const rect = document.createElement('div');
            rect.className = 'minimap-dot minimap-dot-screen';
            rect.style.left = `${x}px`;
            rect.style.top = `${y}px`;
            rect.style.width = `${w}px`;
            rect.style.height = `${h}px`;
            this.dotsContainer.appendChild(rect);
        });
    }
}
