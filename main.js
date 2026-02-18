// --- State Management ---
let blocks = [
    { id: generateId(), type: 'title', content: 'Encuesta de Satisfacción', level: 1, isHidden: false },
    { id: generateId(), type: 'paragraph', content: 'Ayúdanos a mejorar respondiendo estas breves preguntas.', isHidden: false },
    {
        id: generateId(),
        type: 'multiple_choice',
        question: '¿Qué te pareció nuestro servicio?',
        options: [
            { id: generateId(), label: 'Excelente', points: 10, category: 'Promoter' },
            { id: generateId(), label: 'Bueno', points: 5, category: 'Passive' },
            { id: generateId(), label: 'Malo', points: 0, category: 'Detractor' }
        ],
        allowMultiple: false,
        required: true,
        isHidden: false,
        scoringType: 'personality' // none, evaluative, personality
    }
];

let isPreview = false;
let activeMenu = false;
let scoringCategories = [
    { id: 'cat_1', name: 'Líder', color: '#3b82f6' },
    { id: 'cat_2', name: 'Analítico', color: '#10b981' },
    { id: 'cat_3', name: 'Creativo', color: '#f59e0b' }
];

// --- Configuration System ---
let editorConfig = {
    allowAdd: true,
    allowDelete: true,
    allowMove: true,
    allowEdit: true,
    showPublish: true,
    showImport: true,
    showExport: true,
    showConfig: true,
    lockLayout: false,
    allowedItems: [
        'title', 'paragraph', 'image', 'video', 'youtube',
        'multiple_choice', 'dropdown', 'text_response', 'matching', 'rating', 'date',
        'quote', 'callout', 'flipcard', 'code', 'table', 'custom', 'divider'
    ]
};

// --- DOM References ---
const blocksContainer = document.getElementById('blocks-container');
const previewContainer = document.getElementById('preview-container');
const editorView = document.getElementById('editor-view');
const previewView = document.getElementById('preview-view');
const fabTrigger = document.getElementById('fab-trigger');
const fabMenu = document.getElementById('fab-menu');
const previewBtn = document.getElementById('preview-btn');
const jsonModal = document.getElementById('json-modal');
const jsonTextarea = document.getElementById('json-textarea');

// --- Utils ---
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getYoutubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function insertTag(id, tag, styleValue = null) {
    const textarea = document.querySelector(`textarea[data-id="${id}"]`);
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let replacement = '';
    if (tag === 'bold') replacement = `<b>${selectedText}</b>`;
    else if (tag === 'italic') replacement = `<i>${selectedText}</i>`;
    else if (tag === 'color') replacement = `<span style="color: ${styleValue}">${selectedText}</span>`;

    const newText = text.substring(0, start) + replacement + text.substring(end);
    textarea.value = newText;
    updateBlockContent(id, newText);

    textarea.focus();
    const newPos = start + replacement.length;
    textarea.setSelectionRange(newPos, newPos);
}

function parseCSV(text) {
    if (!text) return [];
    return text.trim().split('\n').map(row => row.split(','));
}

// --- Block Operations ---
function addBlock(type) {
    if (!editorConfig.allowAdd || editorConfig.lockLayout) return;
    if (!editorConfig.allowedItems.includes(type)) {
        console.warn(`Block type "${type}" is not allowed in current configuration.`);
        return;
    }
    const newBlock = { id: generateId(), type, isHidden: false };

    // Default properties
    newBlock.content = '';

    if (type === 'title') { newBlock.level = 1; }
    if (type === 'image' || type === 'video' || type === 'youtube') { newBlock.src = ''; newBlock.caption = ''; newBlock.url = ''; }
    if (type === 'quote') newBlock.author = '';
    if (type === 'callout') { newBlock.title = ''; newBlock.variant = 'info'; }
    if (type === 'flipcard') { newBlock.front = ''; newBlock.back = ''; }
    if (type === 'custom') { newBlock.customType = 'tipo_dato'; newBlock.customValue = ''; newBlock.canEditType = true; }

    // Questionnaire Blocks
    if (type === 'multiple_choice' || type === 'dropdown') {
        newBlock.question = '';
        newBlock.options = [
            { id: generateId(), label: 'Opción 1', points: 0, category: '' },
            { id: generateId(), label: 'Opción 2', points: 0, category: '' }
        ];
        newBlock.allowMultiple = false; // Only for multiple_choice
        newBlock.required = false;
        newBlock.scoringType = 'none'; // 'none', 'evaluative', 'personality'
        newBlock.correctAnswer = null; // ID of correct option (evaluative)
        newBlock.points = 0; // Points for correct answer (evaluative)
    }

    if (type === 'text_response') {
        newBlock.question = '';
        newBlock.placeholder = 'Escribe tu respuesta...';
        newBlock.min = 0;
        newBlock.max = 500;
        newBlock.required = false;
        newBlock.scoringType = 'none';
        newBlock.points = 0; // Evaluative points
    }
    if (type === 'matching') {
        newBlock.question = 'Relaciona las columnas';
        newBlock.pairs = [{ left: 'A', right: '1' }, { left: 'B', right: '2' }];
        newBlock.required = false;
        newBlock.scoringType = 'none';
        newBlock.points = 0;
    }
    if (type === 'rating') {
        newBlock.question = '';
        newBlock.max = 5;
        newBlock.required = false;
        newBlock.scoringType = 'none';
        newBlock.points = 0;
    }
    if (type === 'date') {
        newBlock.question = '';
        newBlock.required = false;
        newBlock.scoringType = 'none';
        newBlock.points = 0;
    }

    blocks.push(newBlock);
    render();
    toggleMenu(false);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function removeBlock(id) {
    blocks = blocks.filter(b => b.id !== id);
    render();
}

function updateBlock(id, updates) {
    blocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
}

function moveBlock(index, direction) {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [blocks[index], blocks[targetIndex]] = [blocks[targetIndex], blocks[index]];
    render();
}

function toggleHidden(id) {
    blocks = blocks.map(b => b.id === id ? { ...b, isHidden: !b.isHidden } : b);
    render();
}

// --- Specific Questionnaire Helpers ---
function addOption(id) {
    const block = blocks.find(b => b.id === id);
    if (block && block.options) {
        // Handle migration from string array to object array if needed
        if (block.options.length > 0 && typeof block.options[0] === 'string') {
            block.options = block.options.map(opt => ({ id: generateId(), label: opt, points: 0, category: '' }));
        }
        block.options.push({ id: generateId(), label: `Opción ${block.options.length + 1}`, points: 0, category: '' });
        render();
    }
}

function removeOption(id, index) {
    const block = blocks.find(b => b.id === id);
    if (block && block.options) {
        block.options.splice(index, 1);
        render();
    }
}

function updateOption(id, index, field, value) {
    const block = blocks.find(b => b.id === id);
    if (block && block.options) {
        if (typeof block.options[index] === 'string') {
            // Migrate on the fly if needed
            block.options = block.options.map(opt => ({ id: generateId(), label: opt, points: 0, category: '' }));
        }
        block.options[index][field] = value;
        if (field === 'category' || field === 'points') render();
    }
}

function addPair(id) {
    const block = blocks.find(b => b.id === id);
    if (block && block.pairs) {
        block.pairs.push({ left: '', right: '' });
        render();
    }
}

function removePair(id, index) {
    const block = blocks.find(b => b.id === id);
    if (block && block.pairs) {
        block.pairs.splice(index, 1);
        render();
    }
}

window.updatePair = (id, index, side, value) => {
    const block = blocks.find(b => b.id === id);
    if (block && block.pairs) {
        block.pairs[index][side] = value;
    }
};

window.setRating = (blockId, index) => {
    const container = document.querySelector(`.rating-container[data-block-id="${blockId}"]`);
    if (!container) return;
    const stars = container.querySelectorAll('.star-rating');
    stars.forEach((star, i) => {
        if (i <= index) {
            star.style.fill = '#fbbf24';
            star.style.color = '#fbbf24';
            star.classList.add('is-active');
        } else {
            star.style.fill = 'transparent';
            star.style.color = '#e4e4e7';
            star.classList.remove('is-active');
        }
    });
};


// --- Rendering ---
function migrateBlocks() {
    let changed = false;
    blocks = blocks.map(block => {
        if (!block.scoringType) {
            block.scoringType = 'none';
            changed = true;
        }
        if (block.options && block.options.length > 0) {
            block.options = block.options.map(opt => {
                if (typeof opt === 'string') {
                    changed = true;
                    return { id: generateId(), label: opt, points: 0, category: '' };
                }
                if (!opt.id) {
                    changed = true;
                    opt.id = generateId();
                }
                if (opt.points === undefined) opt.points = 0;
                if (opt.category === undefined) opt.category = '';
                return opt;
            });
        }
        if (block.points === undefined) {
            block.points = 0;
            changed = true;
        }
        if (typeof block.points !== 'number') {
            block.points = parseInt(block.points) || 0;
            changed = true;
        }
        return block;
    });
    return changed;
}

function render() {
    migrateBlocks();
    if (isPreview) {
        editorView.classList.add('hidden');
        previewView.classList.remove('hidden');
        renderPreview();
    } else {
        editorView.classList.remove('hidden');
        previewView.classList.add('hidden');
        renderEditor();
    }
    lucide.createIcons();
    // Re-bind scroll listener or other UI needs if any
}

function renderPreview() {
    previewContainer.innerHTML = '';
    const visibleBlocks = blocks.filter(b => !b.isHidden);

    if (visibleBlocks.length === 0) {
        previewContainer.innerHTML = '<p style="text-align:center; color:#71717a;">No hay contenido para mostrar.</p>';
        return;
    }

    visibleBlocks.forEach(block => {
        const div = document.createElement('div');
        div.innerHTML = renderViewElement(block);
        previewContainer.appendChild(div);
    });

    // Add Submit Button
    const submitContainer = document.createElement('div');
    submitContainer.style.marginTop = '3rem';
    submitContainer.style.textAlign = 'center';
    submitContainer.innerHTML = `
        <button class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1.125rem;" onclick="calculateResults()">
            Enviar Respuestas
        </button>
    `;
    previewContainer.appendChild(submitContainer);
}

function renderEditor() {
    blocksContainer.innerHTML = '';
    if (blocks.length === 0) {
        blocksContainer.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: #a1a1aa; border: 2px dashed #f4f4f5; border-radius: 1rem; background: #fafafa;">
                <p style="font-size: 1.125rem; margin-bottom: 0.5rem;">Cuestionario vacío</p>
                <p style="font-size: 0.875rem;">Añade preguntas usando el botón (+).</p>
            </div>
        `;
        return;
    }

    blocks.forEach((block, index) => {
        const blockEl = document.createElement('div');
        blockEl.className = `block-editor ${block.isHidden ? 'is-hidden' : ''}`;
        blockEl.innerHTML = `
            <div class="block-type-tag">${block.type}</div>
            <div class="block-controls">
                <button class="btn btn-ghost btn-icon" onclick="toggleHidden('${block.id}')" title="${block.isHidden ? 'Mostrar' : 'Ocultar'}" ${!editorConfig.allowEdit ? 'style="display:none"' : ''}>
                    <i data-lucide="${block.isHidden ? 'eye-off' : 'eye'}" style="width: 16px; height: 16px;"></i>
                </button>
                <div style="width: 1px; height: 16px; background: #e4e4e7; margin: 0 4px; ${(!editorConfig.allowEdit || !editorConfig.allowMove || editorConfig.lockLayout) ? 'display:none' : ''}"></div>
                <button class="btn btn-ghost btn-icon" onclick="moveBlock(${index}, 'up')" ${index === 0 || !editorConfig.allowMove || editorConfig.lockLayout ? 'disabled' : ''} ${!editorConfig.allowMove || editorConfig.lockLayout ? 'style="display:none"' : ''}>
                    <i data-lucide="move-up" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-ghost btn-icon" onclick="moveBlock(${index}, 'down')" ${index === blocks.length - 1 || !editorConfig.allowMove || editorConfig.lockLayout ? 'disabled' : ''} ${!editorConfig.allowMove || editorConfig.lockLayout ? 'style="display:none"' : ''}>
                    <i data-lucide="move-down" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn btn-ghost btn-icon hover-red" onclick="removeBlock('${block.id}')" title="Eliminar" ${!editorConfig.allowDelete || editorConfig.lockLayout ? 'style="display:none"' : ''}>
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
            <div class="block-content" style="margin-top: 2rem;">
                ${renderBlockInputs(block)}
            </div>
        `;
        blocksContainer.appendChild(blockEl);
    });
}

function renderBlockInputs(block) {
    const commonHeader = (label) => `
        <div style="font-size: 0.625rem; font-weight: 700; color: #71717a; text-transform: uppercase; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <!-- Icono opcional según el tipo -->
                <span>${label}</span>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                    <input type="checkbox" ${block.required ? 'checked' : ''} onchange="updateBlockField('${block.id}', 'required', this.checked)">
                    <span style="font-weight: 500;">Requerido</span>
                </label>
            </div>
        </div>
    `;

    // Scoring Control (Toggle between modes)
    const scoringControls = (showTotalPoints = false) => `
        <div style="background: #f0fdfa; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid #ccfbf1;">
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                <label style="font-size: 0.75rem; font-weight: 600; color: #115e59;">Modo de Puntuación:</label>
                <select style="font-size: 0.75rem; padding: 0.25rem; border-radius: 0.25rem; border: 1px solid #99f6e4;"
                    onchange="updateBlockField('${block.id}', 'scoringType', this.value)">
                    <option value="none" ${block.scoringType === 'none' ? 'selected' : ''}>Sin puntos</option>
                    <option value="evaluative" ${block.scoringType === 'evaluative' ? 'selected' : ''}>Evaluativo (Correcto/Incorrecto)</option>
                    <option value="personality" ${block.scoringType === 'personality' ? 'selected' : ''}>Personalidad (Categorías)</option>
                </select>
            </div>
            ${showTotalPoints && block.scoringType === 'evaluative' ? `
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                     <label style="font-size: 0.75rem; font-weight: 600; color: #115e59;">Puntos totales:</label>
                     <input type="number" style="width: 60px; font-size: 0.75rem; padding: 0.25rem; border: 1px solid #99f6e4; border-radius: 0.25rem;"
                        value="${block.points || 0}" oninput="updateBlockField('${block.id}', 'points', parseInt(this.value) || 0)">
                </div>
            ` : ''}
            ${block.scoringType === 'personality' && block.type !== 'multiple_choice' && block.type !== 'dropdown' ? `
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                     <label style="font-size: 0.75rem; font-weight: 600; color: #115e59;">Categoría:</label>
                     <select style="font-size: 0.75rem; padding: 0.25rem; border-radius: 0.25rem; border: 1px solid #99f6e4; flex: 1;"
                        onchange="updateBlockField('${block.id}', 'category', this.value)">
                        <option value="">Seleccionar Categoría...</option>
                        ${scoringCategories.map(cat => `
                            <option value="${cat.id}" ${block.category === cat.id ? 'selected' : ''}>${cat.name}</option>
                        `).join('')}
                     </select>
                     <input type="number" style="width: 50px; font-size: 0.75rem; padding: 0.25rem; border: 1px solid #99f6e4; border-radius: 0.25rem;"
                        value="${block.points || 0}" oninput="updateBlockField('${block.id}', 'points', parseInt(this.value) || 0)" placeholder="Pts">
                </div>
            ` : ''}
        </div>
    `;

    switch (block.type) {
        case 'title':
            return `
                <div class="flex">
                    <div class="level-picker">
                        ${[1, 2, 3, 4].map(l => `
                            <button class="level-btn ${block.level === l ? 'active' : ''}" 
                                onclick="updateBlockType('${block.id}', ${l})"
                                ${!editorConfig.allowEdit ? 'disabled' : ''}>H${l}</button>
                        `).join('')}
                    </div>
                    <input type="text" class="block-input title-input h${block.level}-input" 
                        value="${block.content}" 
                        ${!editorConfig.allowEdit ? 'readonly' : ''}
                        oninput="updateBlockContent('${block.id}', this.value)" 
                        placeholder="Título de la Sección">
                </div>
            `;
        case 'paragraph':
            return `
                <div class="rich-text-toolbar" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f4f4f5;">
                    <button class="btn btn-ghost btn-icon" onclick="insertTag('${block.id}', 'bold')" title="Negrita">
                        <i data-lucide="bold" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="btn btn-ghost btn-icon" onclick="insertTag('${block.id}', 'italic')" title="Cursiva">
                        <i data-lucide="italic" style="width: 14px; height: 14px;"></i>
                    </button>
                    <div style="width: 1px; height: 14px; background: #e4e4e7; margin: 0 4px; align-self: center;"></div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        ${['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#6B7280'].map(c => `
                            <button onclick="insertTag('${block.id}', 'color', '${c}')" 
                                style="width: 18px; height: 18px; border-radius: 50%; background: ${c}; border: 1px solid rgba(0,0,0,0.1); cursor: pointer; transition: transform 0.1s;"
                                onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></button>
                        `).join('')}
                    </div>
                </div>
                <textarea class="block-input paragraph-input" data-id="${block.id}"
                    oninput="updateBlockContent('${block.id}', this.value)" 
                    placeholder="Escribe instrucciones o contexto...">${block.content}</textarea>
            `;
        case 'multiple_choice':
        case 'dropdown':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    ${commonHeader(block.type === 'dropdown' ? 'Desplegable' : 'Opción Múltiple')}
                    ${scoringControls(true)}
                    
                    <input type="text" class="block-input" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;"
                        value="${block.question || ''}" oninput="updateBlockField('${block.id}', 'question', this.value)" placeholder="Escribe la pregunta aquí...">
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${(block.options || []).map((opt, i) => {
                // Normalize opt if it's a string (backwards compatibility)
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const optId = typeof opt === 'string' ? 'legacy' : opt.id;
                const optCategory = typeof opt === 'string' ? '' : opt.category;
                const optPoints = typeof opt === 'string' ? 0 : opt.points;

                return `
                                <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 0.5rem; align-items: start; padding: 0.5rem; background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem;">
                                    <div style="padding-top: 6px;">
                                        ${block.scoringType === 'evaluative' ? `
                                            <input type="radio" name="correct-${block.id}" ${block.correctAnswer === optId ? 'checked' : ''}
                                                onchange="updateBlockField('${block.id}', 'correctAnswer', '${optId}')" title="Marcar como respuesta correcta">
                                        ` : `
                                            <i data-lucide="${block.type === 'dropdown' ? 'list' : (block.allowMultiple ? 'square' : 'circle')}" style="width: 16px; height: 16px; color: #a1a1aa;"></i>
                                        `}
                                    </div>
                                    
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        <input type="text" class="block-input" style="font-size: 0.875rem;"
                                            value="${optLabel}" oninput="updateOption('${block.id}', ${i}, 'label', this.value)" placeholder="Texto de la opción">
                                        
                                        ${block.scoringType === 'personality' ? `
                                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                                <select class="block-input" style="background: #f0fdfa; font-size: 0.75rem; padding: 4px; flex: 1;"
                                                    onchange="updateOption('${block.id}', ${i}, 'category', this.value)">
                                                    <option value="">Seleccionar Categoría...</option>
                                                    ${scoringCategories.map(cat => `
                                                        <option value="${cat.id}" ${optCategory === cat.id ? 'selected' : ''}>${cat.name}</option>
                                                    `).join('')}
                                                </select>
                                                <input type="number" class="block-input" style="background: #f0fdfa; font-size: 0.75rem; padding: 4px; width: 50px;"
                                                    value="${optPoints || 0}" oninput="updateOption('${block.id}', ${i}, 'points', parseInt(this.value) || 0)" placeholder="Pts">
                                            </div>
                                        ` : ''}
                                    </div>

                                    <button class="btn btn-ghost btn-icon" onclick="removeOption('${block.id}', ${i})"><i data-lucide="x" style="width: 14px;"></i></button>
                                </div>
                            `;
            }).join('')}
                    </div>
                    
                    <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e4e4e7; padding-top: 0.5rem;">
                        <button class="btn btn-ghost" onclick="addOption('${block.id}')" style="font-size: 0.75rem;"><i data-lucide="plus" style="width: 14px;"></i> Añadir Opción</button>
                        ${block.type === 'multiple_choice' ? `
                        <label style="font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                            <input type="checkbox" ${block.allowMultiple ? 'checked' : ''} onchange="updateBlockField('${block.id}', 'allowMultiple', this.checked)">
                            Selección Múltiple
                        </label>
                        ` : ''}
                    </div>
                </div>
            `;
        case 'text_response':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    ${commonHeader('Texto Libre')}
                    ${scoringControls(true)}
                    <input type="text" class="block-input" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;"
                        value="${block.question || ''}" oninput="updateBlockField('${block.id}', 'question', this.value)" placeholder="Escribe la pregunta aquí...">
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="font-size: 0.625rem; font-weight: 700; color: #a1a1aa;">PLACEHOLDER</label>
                            <input type="text" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem;"
                                value="${block.placeholder || ''}" oninput="updateBlockField('${block.id}', 'placeholder', this.value)">
                        </div>
                         <div style="display: flex; gap: 0.5rem;">
                            <div>
                                <label style="font-size: 0.625rem; font-weight: 700; color: #a1a1aa;">MIN CARACTERES</label>
                                <input type="number" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem;"
                                    value="${block.min || 0}" oninput="updateBlockField('${block.id}', 'min', parseInt(this.value))">
                            </div>
                            <div>
                                <label style="font-size: 0.625rem; font-weight: 700; color: #a1a1aa;">MAX CARACTERES</label>
                                <input type="number" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem;"
                                    value="${block.max || 500}" oninput="updateBlockField('${block.id}', 'max', parseInt(this.value))">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        case 'matching':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    ${commonHeader('Relacionar Columnas')}
                    ${scoringControls(true)}
                    <input type="text" class="block-input" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;"
                        value="${block.question || ''}" oninput="updateBlockField('${block.id}', 'question', this.value)" placeholder="Instrucción (ej. Relaciona los conceptos)...">
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${(block.pairs || []).map((pair, i) => `
                            <div style="display: grid; grid-template-columns: 1fr 16px 1fr 24px; gap: 0.5rem; align-items: center;">
                                <input type="text" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem;"
                                    value="${pair.left}" oninput="updatePair('${block.id}', ${i}, 'left', this.value)" placeholder="Columna A">
                                <i data-lucide="arrow-right" style="width: 14px; color: #a1a1aa;"></i>
                                <input type="text" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem;"
                                    value="${pair.right}" oninput="updatePair('${block.id}', ${i}, 'right', this.value)" placeholder="Columna B">
                                <button class="btn btn-ghost btn-icon" onclick="removePair('${block.id}', ${i})"><i data-lucide="x" style="width: 14px;"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-ghost" onclick="addPair('${block.id}')" style="margin-top: 1rem; font-size: 0.75rem;"><i data-lucide="plus" style="width: 14px;"></i> Añadir Par</button>
                </div>
            `;
        case 'rating':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    ${commonHeader('Valoración / Rating')}
                    ${scoringControls(true)}
                    <input type="text" class="block-input" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;"
                        value="${block.question || ''}" oninput="updateBlockField('${block.id}', 'question', this.value)" placeholder="Pregunta a valorar...">
                    
                    <div>
                        <label style="font-size: 0.625rem; font-weight: 700; color: #a1a1aa;">MAX ESTRELLAS</label>
                        <input type="number" class="block-input" style="background: white; border: 1px solid #e4e4e7; padding: 0.25rem; border-radius: 0.25rem; width: 60px;"
                            value="${block.max || 5}" oninput="updateBlockField('${block.id}', 'max', parseInt(this.value))">
                    </div>
                </div>
            `;
        case 'date':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    ${commonHeader('Selector de Fecha')}
                    ${scoringControls(true)}
                    <input type="text" class="block-input" style="font-weight: 600; font-size: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.5rem;"
                        value="${block.question || ''}" oninput="updateBlockField('${block.id}', 'question', this.value)" placeholder="Etiqueta de la fecha (ej. Fecha de nacimiento)...">
                </div>
            `;
        case 'custom':
            return `
                <div style="background: #f9fafb; padding: 1.25rem; border-radius: 0.75rem; border: 1px dashed #d1d5db;">
                    <div style="display: flex; items-center; gap: 0.5rem; margin-bottom: 1rem; color: #6b7280; font-size: 0.625rem; font-weight: 700; text-transform: uppercase;">
                        <i data-lucide="terminal" style="width: 14px; height: 14px;"></i> Componente Personalizado
                    </div>
                    <div style="display: grid; gap: 1rem;">
                        <div>
                            <label style="font-size: 0.625rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">Tipo / Etiqueta</label>
                            <input type="text" class="block-input" 
                                style="background: ${block.canEditType !== false ? 'white' : '#f3f4f6'}; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; color: ${block.canEditType !== false ? 'inherit' : '#9ca3af'}; cursor: ${block.canEditType !== false ? 'text' : 'not-allowed'};"
                                ${block.canEditType !== false ? '' : 'readonly'}
                                oninput="updateBlockField('${block.id}', 'customType', this.value)" 
                                value="${block.customType || ''}" 
                                placeholder="ej. mapa, widget...">
                            ${block.canEditType === false ? '<span style="font-size: 10px; color: #ef4444; margin-top: 4px; display: block;">Campo bloqueado</span>' : ''}
                        </div>
                        <div>
                            <label style="font-size: 0.625rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; margin-bottom: 0.25rem; display: block;">Valor / Configuración</label>
                            <textarea class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; min-height: 80px;"
                                oninput="updateBlockField('${block.id}', 'customValue', this.value)" placeholder="JSON o valor...">${block.customValue || ''}</textarea>
                        </div>
                    </div>
                </div>
            `;
        case 'flipcard':
            return `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    <div>
                        <label style="font-size: 0.625rem; font-weight: 700; color: #71717a; text-transform: uppercase; margin-bottom: 0.5rem; display: block;">Frente</label>
                        <textarea class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.875rem;" 
                            oninput="updateBlockField('${block.id}', 'front', this.value)" placeholder="Frente de la tarjeta">${block.front || ''}</textarea>
                    </div>
                    <div>
                        <label style="font-size: 0.625rem; font-weight: 700; color: #71717a; text-transform: uppercase; margin-bottom: 0.5rem; display: block;">Reverso</label>
                        <textarea class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.875rem;" 
                            oninput="updateBlockField('${block.id}', 'back', this.value)" placeholder="Reverso de la tarjeta">${block.back || ''}</textarea>
                    </div>
                </div>
            `;
        case 'quote':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid black;">
                    <textarea class="block-input" style="font-size: 1.25rem; font-style: italic; font-family: var(--font-serif);" 
                        oninput="updateBlockContent('${block.id}', this.value)" placeholder="Cita...">${block.content}</textarea>
                    <input type="text" class="block-input" style="font-size: 0.875rem; color: #71717a; margin-top: 0.5rem;" 
                        oninput="updateBlockField('${block.id}', 'author', this.value)" value="${block.author || ''}" placeholder="— Autor">
                </div>
            `;
        case 'image':
        case 'video':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    <label style="font-size: 0.625rem; font-weight: 700; color: #71717a; text-transform: uppercase; margin-bottom: 0.5rem; display: block;">URL del recurso</label>
                    <input type="text" class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.5rem; font-size: 0.875rem; margin-bottom: 0.5rem;"
                        oninput="updateBlockField('${block.id}', 'src', this.value)" value="${block.src || ''}" placeholder="https://...">
                    <input type="text" class="block-input" style="font-size: 0.75rem; text-align: center; color: #a1a1aa;" 
                        oninput="updateBlockField('${block.id}', 'caption', this.value)" value="${block.caption || ''}" placeholder="Pie de foto / Leyenda">
                </div>
            `;
        case 'youtube':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    <label style="font-size: 0.625rem; font-weight: 700; color: #71717a; text-transform: uppercase; margin-bottom: 0.5rem; display: block;">URL de YouTube</label>
                    <input type="text" class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.5rem; font-size: 0.875rem; margin-bottom: 0.5rem;"
                        oninput="updateBlockField('${block.id}', 'url', this.value)" value="${block.url || ''}" placeholder="https://youtube.com/watch?v=...">
                    <input type="text" class="block-input" style="font-size: 0.75rem; text-align: center; color: #a1a1aa;" 
                        oninput="updateBlockField('${block.id}', 'caption', this.value)" value="${block.caption || ''}" placeholder="Leyenda del video">
                </div>
            `;
        case 'callout':
            return `
                <div style="border-radius: 0.5rem; overflow: hidden; border: 1px solid #e4e4e7;">
                    <div style="display: flex; gap: 0.5rem; padding: 0.5rem; background: #f9fafb; border-bottom: 1px solid #e4e4e7;">
                        ${['info', 'warning', 'success', 'neutral'].map(v => `
                            <button onclick="updateBlockField('${block.id}', 'variant', '${v}')" 
                                style="padding: 0.25rem 0.5rem; border-radius: 1rem; font-size: 0.625rem; font-weight: 700; border: none; cursor: pointer;
                                background: ${block.variant === v ? '#000' : '#fff'}; color: ${block.variant === v ? '#fff' : '#71717a'}; border: 1px solid #e4e4e7;">
                                ${v.toUpperCase()}
                            </button>
                        `).join('')}
                    </div>
                    <div style="padding: 1rem;">
                        <input type="text" class="block-input" style="font-weight: 700; margin-bottom: 0.5rem;" 
                            oninput="updateBlockField('${block.id}', 'title', this.value)" value="${block.title || ''}" placeholder="Título del aviso">
                        <textarea class="block-input" style="font-size: 0.875rem;" 
                            oninput="updateBlockContent('${block.id}', this.value)" placeholder="Contenido...">${block.content}</textarea>
                    </div>
                </div>
            `;
        case 'code':
            return `
                <textarea class="block-input" style="background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 1rem; border-radius: 0.5rem; min-height: 120px;" 
                    oninput="updateBlockContent('${block.id}', this.value)" placeholder="// escribe tu código aquí...">${block.content}</textarea>
            `;
        case 'divider':
            return `<div style="height: 1px; background: #e4e4e7; width: 100%; margin: 1rem 0;"></div>`;
        case 'table':
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">
                    <p style="font-size: 0.625rem; font-weight: 700; color: #71717a; margin-bottom: 0.5rem;">TABLA (CSV: Col1, Col2...)</p>
                    <textarea class="block-input" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.5rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; min-height: 100px;" 
                        oninput="updateBlockContent('${block.id}', this.value)" placeholder="Encabezado1, Encabezado2\nDato1, Dato2">${block.content}</textarea>
                </div>
            `;
        default:
            return `<div style="color: #a1a1aa; font-style: italic;">Editor no implementado para ${block.type}</div>`;
    }
}

function renderViewElement(block) {
    const requiredBadge = block.required ? '<span style="color: #ef4444; margin-left: 4px;">*</span>' : '';

    switch (block.type) {
        case 'title':
            return `<h${block.level} class="view-element view-title-${block.level}">${block.content}</h${block.level}>`;
        case 'paragraph':
            return `<div class="view-element view-paragraph">${block.content}</div>`;
        case 'multiple_choice':
            return `
                <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem;">${block.question}${requiredBadge}</div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${(block.options || []).map(opt => {
                const label = typeof opt === 'string' ? opt : opt.label;
                const optId = typeof opt === 'string' ? '' : opt.id;
                return `
                                <label style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; padding: 0.5rem; border-radius: 0.5rem; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'">
                                    <input type="${block.allowMultiple ? 'checkbox' : 'radio'}" name="q-${block.id}" 
                                        data-block-id="${block.id}" data-option-id="${optId}" value="${label}"
                                        style="width: 1.125rem; height: 1.125rem; accent-color: black;">
                                    <span>${label}</span>
                                </label>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        case 'dropdown':
            return `
                 <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem;">${block.question}${requiredBadge}</div>
                    <select data-block-id="${block.id}" style="width: 100%; padding: 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.5rem; font-family: inherit; font-size: 1rem; background: white;">
                        <option value="" disabled selected>Selecciona una opción...</option>
                        ${(block.options || []).map(opt => {
                const label = typeof opt === 'string' ? opt : opt.label;
                const optId = typeof opt === 'string' ? '' : opt.id;
                return `<option value="${optId}">${label}</option>`;
            }).join('')}
                    </select>
                </div>
            `;
        case 'text_response':
            return `
                <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem; display: flex; justify-content: space-between;">
                        <span>${block.question}${requiredBadge}</span>
                    </div>
                    <textarea data-block-id="${block.id}"
                        style="width: 100%; padding: 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.5rem; min-height: 100px; font-family: inherit;"
                        placeholder="${block.placeholder || ''}"></textarea>
                    <div style="font-size: 0.75rem; color: #71717a; margin-top: 0.5rem; text-align: right;">
                        Mín: ${block.min || 0} | Máx: ${block.max || 500}
                    </div>
                </div>
            `;
        case 'matching':
            const rightOptions = [...(block.pairs || [])].sort(() => Math.random() - 0.5);
            return `
                <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem;">${block.question}${requiredBadge}</div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${(block.pairs || []).map((pair, i) => `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: center;">
                                <div style="padding: 0.75rem; background: #f4f4f5; border-radius: 0.5rem; font-size: 0.875rem;">${pair.left}</div>
                                <select data-block-id="${block.id}" data-index="${i}" style="width: 100%; padding: 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.5rem; font-size: 0.875rem;">
                                    <option value="">Seleccionar...</option>
                                    ${rightOptions.map(opt => `<option value="${opt.right}">${opt.right}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        case 'rating':
            return `
                <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem; text-align: center;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem;">${block.question}${requiredBadge}</div>
                    <div class="rating-container" data-block-id="${block.id}" style="display: flex; gap: 0.5rem; justify-content: center;">
                        ${Array.from({ length: block.max || 5 }).map((_, i) => `
                            <i data-lucide="star" class="star-rating" data-index="${i}" 
                                style="width: 32px; height: 32px; color: #e4e4e7; fill: transparent; cursor: pointer; transition: all 0.2s;"
                                onclick="setRating('${block.id}', ${i})"></i>
                        `).join('')}
                    </div>
                </div>
            `;
        case 'date':
            return `
                <div class="view-element" style="background: white; border: 1px solid #e4e4e7; border-radius: 0.75rem; padding: 1.5rem;">
                    <div style="font-weight: 600; font-size: 1.125rem; margin-bottom: 1rem;">${block.question}${requiredBadge}</div>
                    <input type="date" data-block-id="${block.id}" style="padding: 0.75rem; border: 1px solid #d4d4d8; border-radius: 0.5rem; width: 100%; font-family: inherit;">
                </div>
            `;
        case 'custom':
            return `
                <div class="view-element" style="background: #f9fafb; padding: 1.5rem; border-radius: 0.75rem; border: 1px dashed #cbd5e1; font-family: monospace; font-size: 0.8125rem;">
                    <div style="display: flex; items-center; gap: 0.5rem; margin-bottom: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 0.625rem;">
                        <i data-lucide="terminal" style="width: 12px; height: 12px;"></i> Personalizado: ${block.customType || 'Sin tipo'}
                    </div>
                    <div style="color: #334155; white-space: pre-wrap;">${block.customValue || 'Sin valor'}</div>
                </div>
            `;
        case 'quote':
            return `
                <figure class="view-element view-quote">
                    <blockquote>"${block.content}"</blockquote>
                    ${block.author ? `<figcaption>— ${block.author}</figcaption>` : ''}
                </figure>
            `;
        case 'flipcard':
            return `
                <div class="view-element flip-card" onclick="this.classList.toggle('is-flipped')">
                    <div class="flip-card-inner">
                        <div class="flip-card-front">
                            <h3 style="font-family: var(--font-serif); font-weight: 700; font-size: 1.5rem;">${block.front || 'Frente'}</h3>
                            <p style="font-size: 0.75rem; color: #a1a1aa; text-transform: uppercase; margin-top: 1rem;">Toca para voltear</p>
                        </div>
                        <div class="flip-card-back">
                            <p style="font-family: var(--font-serif); font-size: 1.25rem;">${block.back || 'Reverso'}</p>
                        </div>
                    </div>
                </div>
            `;
        case 'image':
            return `
                <div class="view-element">
                    <img src="${block.src || 'https://via.placeholder.com/800x400'}" style="width: 100%; border-radius: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        ${block.caption ? `<p style="text-align: center; color: #6b7280; font-size: 0.875rem; font-style: italic; margin-top: 0.75rem;">${block.caption}</p>` : ''}
                    </div>
            `;
        case 'youtube':
            const vidId = getYoutubeId(block.url);
            return `
                <div class="view-element">
                    <div style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: 0.75rem; overflow: hidden; background: #000;">
                        ${vidId ? `<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" 
                            src="https://www.youtube.com/embed/${vidId}" allowfullscreen></iframe>` : ''}
                    </div>
                    ${block.caption ? `<p style="text-align: center; color: #6b7280; font-size: 0.875rem; font-style: italic; margin-top: 0.75rem;">${block.caption}</p>` : ''}
                </div>
            `;
        case 'callout':
            const colors = {
                info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
                warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
                success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
                neutral: { bg: '#f9fafb', border: '#6b7280', text: '#111827' }
            };
            const variant = colors[block.variant || 'info'];
            return `
                <div class="view-element" style="background: ${variant.bg}; border-left: 4px solid ${variant.border}; padding: 1.5rem; border-radius: 0 0.5rem 0.5rem 0;">
                    ${block.title ? `<strong style="display: block; margin-bottom: 0.5rem; color: ${variant.text};">${block.title}</strong>` : ''}
            <div style="color: ${variant.text}; line-height: 1.6;">${block.content}</div>
                </div>
            `;
        case 'code':
            return `
                <div class="view-element" style="background: #1e1e1e; color: #d4d4d4; padding: 1.5rem; border-radius: 0.75rem; overflow-x: auto; box-shadow: 0 10px 20px rgba(0,0,0,0.1);">
                    <pre style="font-family: monospace; font-size: 0.875rem;"><code>${block.content}</code></pre>
                </div>
            `;
        case 'divider':
            return `<hr style="border: none; border-top: 2px solid #f3f4f6; margin: 3rem auto; width: 50%;">`;
        case 'table':
            const rows = parseCSV(block.content);
            return `
                <div class="view-element" style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 0.75rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem;">
                        <tbody>
                            ${rows.map((row, i) => `
                                <tr style="border-bottom: 1px solid #e5e7eb; background: ${i === 0 ? '#f9fafb' : 'transparent'};">
                                    ${row.map(cell => `<td style="padding: 0.75rem 1rem; ${i === 0 ? 'font-weight: 700;' : ''}">${cell}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        default:
            return '';
    }
}

// --- Event Handlers ---
window.updateBlockContent = (id, value) => {
    updateBlock(id, { content: value });
};

window.updateBlockField = (id, field, value) => {
    updateBlock(id, { [field]: value });
    const needsRender = ['variant', 'scoringType', 'category', 'correctAnswer', 'points', 'allowMultiple', 'required'];
    if (needsRender.includes(field)) render();
};

window.updateBlockType = (id, level) => {
    updateBlock(id, { level });
    render();
};

window.revealSpoiler = (el) => {
    const wrapper = el.parentElement;
    wrapper.classList.remove('spoiler-wrapper');
    el.remove();
    wrapper.querySelector('.spoiler-content-blurred').classList.remove('spoiler-content-blurred');
}

function toggleMenu(force) {
    activeMenu = force !== undefined ? force : !activeMenu;
    fabMenu.classList.toggle('open', activeMenu);
    fabTrigger.classList.toggle('active', activeMenu);
}

function togglePreview() {
    isPreview = !isPreview;
    previewBtn.innerHTML = isPreview
        ? '<i data-lucide="edit-3" style="width: 16px; height: 16px;"></i> Editar'
        : '<i data-lucide="eye" style="width: 16px; height: 16px;"></i> Vista Previa';
    render();
}

function openJsonModal() {
    jsonTextarea.value = JSON.stringify(blocks, null, 2);
    jsonModal.classList.add('open');
}

function closeJsonModal() {
    jsonModal.classList.remove('open');
}

function importJson(mode) {
    try {
        const data = JSON.parse(jsonTextarea.value);
        if (!Array.isArray(data)) throw new Error('El JSON debe ser un array de bloques.');

        const cleanData = data.map(b => ({ ...b, id: generateId() }));
        if (mode === 'replace') {
            if (confirm('¿Estás seguro de que quieres reemplazar todo el contenido?')) {
                blocks = cleanData;
            } else return;
        } else {
            blocks = [...blocks, ...cleanData];
        }
        closeJsonModal();
        render();
    } catch (e) {
        alert('Error parsing JSON: ' + e.message);
    }
}

function copyJson() {
    jsonTextarea.select();
    document.execCommand('copy');
    alert('JSON copiado al portapapeles');
}

function downloadJson() {
    const blob = new Blob([jsonTextarea.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuestionario - ${Date.now()}.json`;
    a.click();
}

// --- Global API ---
window.ArticleEditorAPI = {
    getJson: () => JSON.stringify(blocks, null, 2),
    addElement: (type, data = {}) => addBlock(type, data),
    clear: () => { blocks = []; render(); },
    setJson: (jsonString) => {
        try {
            const parsed = JSON.parse(jsonString);
            if (Array.isArray(parsed)) {
                blocks = parsed.map(b => ({ ...b, id: b.id || generateId() }));
                render();
            }
        } catch (e) { console.error("JSON inválido", e); }
    },
    setConfig: (config) => {
        editorConfig = { ...editorConfig, ...config };
        render();
        updateUI();
    },
    getConfig: () => ({ ...editorConfig })
};

function updateUI() {
    const fabContainer = document.querySelector('.fab-container');
    const publishBtn = document.querySelector('.btn-primary');
    const configBtn = document.querySelector('header .btn-ghost.btn-icon');

    if (fabContainer) fabContainer.style.display = (editorConfig.allowAdd && !editorConfig.lockLayout) ? 'flex' : 'none';
    if (publishBtn) publishBtn.style.display = editorConfig.showPublish ? 'inline-flex' : 'none';
    if (configBtn) configBtn.style.display = editorConfig.showConfig ? 'inline-flex' : 'none';

    // Update menu items
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const onclickVal = item.getAttribute('onclick');
        if (onclickVal) {
            const matches = onclickVal.match(/'([^']+)'/);
            if (matches && matches[1]) {
                item.style.display = editorConfig.allowedItems.includes(matches[1]) ? 'flex' : 'none';
            }
        }
    });

    const importBtns = document.querySelectorAll('#json-modal .btn-ghost[onclick*="importJson"], #json-modal .btn-primary');
    const exportBtns = document.querySelectorAll('#json-modal .btn-ghost[onclick*="copyJson"], #json-modal .btn-ghost[onclick*="downloadJson"]');

    importBtns.forEach(b => b.style.display = editorConfig.showImport ? 'inline-flex' : 'none');
    exportBtns.forEach(b => b.style.display = editorConfig.showExport ? 'inline-flex' : 'none');
}

document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    render();

    fabTrigger.addEventListener('click', () => toggleMenu());
    previewBtn.addEventListener('click', togglePreview);

    document.addEventListener('click', (e) => {
        if (!fabTrigger.contains(e.target) && !fabMenu.contains(e.target) && activeMenu) {
            toggleMenu(false);
        }
    });

    // Make global functions available
    window.addBlock = addBlock;
    window.removeBlock = removeBlock;
    window.moveBlock = moveBlock;
    window.toggleHidden = toggleHidden;
    window.togglePreview = togglePreview;
    window.openJsonModal = openJsonModal;
    window.closeJsonModal = closeJsonModal;
    window.importJson = importJson;
    window.copyJson = copyJson;
    window.downloadJson = downloadJson;

    // Scoring Helpers
    window.addOption = addOption;
    window.removeOption = removeOption;
    window.updateOption = updateOption;
    window.addPair = addPair;
    window.removePair = removePair;
    window.updatePair = updatePair;

    // Scoring Global Config
    const scoringModal = document.getElementById('scoring-modal');
    const categoriesList = document.getElementById('categories-list');
    const resultsModal = document.getElementById('results-modal');
    const resultsBody = document.getElementById('results-body');

    window.openScoringModal = () => {
        renderCategories();
        scoringModal.classList.add('open');
    }
    window.closeScoringModal = () => scoringModal.classList.remove('open');

    function renderCategories() {
        categoriesList.innerHTML = '';
        scoringCategories.forEach((cat, i) => {
            const div = document.createElement('div');
            div.style.display = 'grid';
            div.style.gridTemplateColumns = '1fr auto auto';
            div.style.gap = '0.5rem';
            div.style.alignItems = 'center';
            div.innerHTML = `
                < input type = "text" class="block-input" value = "${cat.name}" oninput = "updateCategory(${i}, 'name', this.value)" placeholder = "Nombre de categoría" >
                    <input type="color" value="${cat.color || '#3b82f6'}" oninput="updateCategory(${i}, 'color', this.value)" style="width: 32px; height: 32px; border: none; padding: 0; background: none; cursor: pointer;">
                        <button class="btn btn-ghost btn-icon" onclick="removeCategory(${i})"><i data-lucide="trash-2" style="width: 14px; color: #ef4444;"></i></button>
                        `;
            categoriesList.appendChild(div);
        });
        lucide.createIcons();
    }

    window.addScoringCategory = () => {
        scoringCategories.push({ id: 'cat_' + Date.now().toString(36), name: 'Nueva Categoría', color: '#3b82f6' });
        renderCategories();
        render(); // Update selects in editor
    }

    window.removeCategory = (index) => {
        scoringCategories.splice(index, 1);
        renderCategories();
        render();
    }

    window.updateCategory = (index, field, value) => {
        scoringCategories[index][field] = value;
        // No full render needed for name/color while typing
    }

    // Calculation Logic
    window.calculateResults = () => {
        let evaluativeScore = 0;
        let totalPossible = 0;
        let personalityScores = {}; // {catId: totalPoints }

        scoringCategories.forEach(cat => personalityScores[cat.id] = 0);

        blocks.forEach(block => {
            if (block.isHidden) return;

            if (block.scoringType === 'evaluative') {
                totalPossible += (block.points || 0);
                if (block.type === 'multiple_choice' || block.type === 'dropdown') {
                    const inputs = document.querySelectorAll(`[data-block-id="${block.id}"]`);
                    let isCorrect = false;

                    if (block.type === 'dropdown') {
                        const select = document.querySelector(`select[data-block-id="${block.id}"]`);
                        if (select && select.value === block.correctAnswer) isCorrect = true;
                    } else {
                        const selected = Array.from(inputs).filter(i => i.checked);
                        if (selected.length > 0) {
                            isCorrect = selected.some(s => s.dataset.optionId === block.correctAnswer);
                        }
                    }
                    if (isCorrect) evaluativeScore += (block.points || 0);
                } else if (block.type === 'matching') {
                    const selects = document.querySelectorAll(`select[data-block-id="${block.id}"]`);
                    let allCorrect = true;
                    selects.forEach(sel => {
                        const index = parseInt(sel.dataset.index);
                        const expected = block.pairs[index].right;
                        if (sel.value !== expected) allCorrect = false;
                    });
                    if (allCorrect && selects.length > 0) evaluativeScore += (block.points || 0);
                } else if (block.type === 'text_response') {
                    const textarea = document.querySelector(`textarea[data-block-id="${block.id}"]`);
                    if (textarea && textarea.value.trim().length > 0) {
                        evaluativeScore += (block.points || 0);
                    }
                } else if (block.type === 'date') {
                    const input = document.querySelector(`input[data-block-id="${block.id}"]`);
                    if (input && input.value) {
                        evaluativeScore += (block.points || 0);
                    }
                }
            } else if (block.scoringType === 'personality') {
                if (block.type === 'multiple_choice' || block.type === 'dropdown') {
                    const inputs = document.querySelectorAll(`[data-block-id="${block.id}"]`);

                    if (block.type === 'dropdown') {
                        const select = document.querySelector(`select[data-block-id="${block.id}"]`);
                        if (select) {
                            const opt = block.options.find(o => o.id === select.value);
                            if (opt && opt.category) {
                                personalityScores[opt.category] = (personalityScores[opt.category] || 0) + (opt.points || 0);
                            }
                        }
                    } else {
                        const selected = Array.from(inputs).filter(i => i.checked);
                        selected.forEach(s => {
                            const optId = s.dataset.optionId;
                            const opt = block.options.find(o => o.id === optId);
                            if (opt && opt.category) {
                                personalityScores[opt.category] = (personalityScores[opt.category] || 0) + (opt.points || 0);
                            }
                        });
                    }
                } else {
                    // Block-level personality scoring
                    let isFulfilled = false;
                    if (block.type === 'matching') {
                        const selects = document.querySelectorAll(`select[data-block-id="${block.id}"]`);
                        let allCorrect = true;
                        selects.forEach(sel => {
                            const index = parseInt(sel.dataset.index);
                            const expected = block.pairs[index].right;
                            if (sel.value !== expected) allCorrect = false;
                        });
                        if (allCorrect && selects.length > 0) isFulfilled = true;
                    } else if (block.type === 'text_response') {
                        const textarea = document.querySelector(`textarea[data-block-id="${block.id}"]`);
                        if (textarea && textarea.value.trim().length > 0) isFulfilled = true;
                    } else if (block.type === 'rating') {
                        const stars = document.querySelectorAll(`.rating-container[data-block-id="${block.id}"] .star-rating.is-active`);
                        if (stars.length > 0) isFulfilled = true;
                    } else if (block.type === 'date') {
                        const input = document.querySelector(`input[data-block-id="${block.id}"]`);
                        if (input && input.value) isFulfilled = true;
                    }

                    if (isFulfilled && block.category) {
                        personalityScores[block.category] = (personalityScores[block.category] || 0) + (block.points || 0);
                    }
                }
            }
        });

        showResults(evaluativeScore, totalPossible, personalityScores);
    }

    function showResults(evalScore, maxScore, personalityScores) {
        resultsBody.innerHTML = '';

        if (maxScore > 0) {
            resultsBody.innerHTML += `
                <div style="margin-bottom: 2rem; padding: 1.5rem; background: #f0fdf4; border-radius: 1rem; border: 1px solid #bbf7d0;">
                    <h4 style="color: #166534; margin-bottom: 0.5rem; font-size: 1.25rem;">Resultado de Evaluación</h4>
                    <div style="font-size: 2.5rem; font-weight: 800; color: #15803d;">${evalScore} / ${maxScore}</div>
                    <p style="color: #166534; font-size: 0.875rem;">(${Math.round(evalScore / maxScore * 100)}%)</p>
                </div>
            `;
        }

        const personalityEntries = Object.entries(personalityScores).filter(([id, val]) => val > 0);
        if (personalityEntries.length > 0) {
            resultsBody.innerHTML += '<h4 style="margin-bottom: 1rem; text-align: left;">Perfil de Personalidad</h4>';
            personalityEntries.sort((a, b) => b[1] - a[1]);

            personalityEntries.forEach(([id, val]) => {
                const cat = scoringCategories.find(c => c.id === id) || { name: 'Desconocido', color: '#71717a' };
                resultsBody.innerHTML += `
                        <div style="margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span style="font-weight: 600;">${cat.name}</span>
                                <span style="color: #71717a;">${val} pts</span>
                            </div>
                            <div style="height: 8px; width: 100%; background: #f4f4f5; border-radius: 4px; overflow: hidden;">
                                <div style="height: 100%; width: ${Math.min(100, val * 10)}%; background: ${cat.color};"></div>
                            </div>
                        </div>
                        `;
            });
        }

        if (maxScore === 0 && personalityEntries.length === 0) {
            resultsBody.innerHTML = '<p style="color: #71717a;">No se detectaron puntuaciones en las respuestas seleccionadas.</p>';
        }

        resultsModal.classList.add('open');
    }

    window.closeResultsModal = () => resultsModal.classList.remove('open');
});
