/**
 * Judo Weight Categories Configuration
 * Official weight categories for different age groups
 */

const WEIGHT_CATEGORIES = {
    SENIOR: {
        name: 'Senior',
        ageRange: 'Above 15',
        minAge: 15,
        maxAge: null,
        men: [
            { value: 60, label: '-60 kg', max: 60 },
            { value: 66, label: '-66 kg', max: 66 },
            { value: 73, label: '-73 kg', max: 73 },
            { value: 81, label: '-81 kg', max: 81 },
            { value: 90, label: '-90 kg', max: 90 },
            { value: 100, label: '-100 kg', max: 100 },
            { value: 101, label: '+100 kg', max: null, min: 100 }
        ],
        women: [
            { value: 48, label: '-48 kg', max: 48 },
            { value: 52, label: '-52 kg', max: 52 },
            { value: 57, label: '-57 kg', max: 57 },
            { value: 63, label: '-63 kg', max: 63 },
            { value: 70, label: '-70 kg', max: 70 },
            { value: 78, label: '-78 kg', max: 78 },
            { value: 79, label: '+78 kg', max: null, min: 78 }
        ]
    },
    JUNIOR: {
        name: 'Junior',
        ageRange: 'Under 21',
        minAge: 0,
        maxAge: 21,
        men: [
            { value: 55, label: '-55 kg', max: 55 },
            { value: 60, label: '-60 kg', max: 60 },
            { value: 66, label: '-66 kg', max: 66 },
            { value: 73, label: '-73 kg', max: 73 },
            { value: 81, label: '-81 kg', max: 81 },
            { value: 90, label: '-90 kg', max: 90 },
            { value: 100, label: '-100 kg', max: 100 },
            { value: 101, label: '+100 kg', max: null, min: 100 }
        ],
        women: [
            { value: 44, label: '-44 kg', max: 44 },
            { value: 48, label: '-48 kg', max: 48 },
            { value: 52, label: '-52 kg', max: 52 },
            { value: 57, label: '-57 kg', max: 57 },
            { value: 63, label: '-63 kg', max: 63 },
            { value: 70, label: '-70 kg', max: 70 },
            { value: 78, label: '-78 kg', max: 78 },
            { value: 79, label: '+78 kg', max: null, min: 78 }
        ]
    },
    CADET: {
        name: 'Cadet',
        ageRange: 'Under 18',
        minAge: 0,
        maxAge: 18,
        men: [
            { value: 50, label: '-50 kg', max: 50 },
            { value: 55, label: '-55 kg', max: 55 },
            { value: 60, label: '-60 kg', max: 60 },
            { value: 66, label: '-66 kg', max: 66 },
            { value: 73, label: '-73 kg', max: 73 },
            { value: 81, label: '-81 kg', max: 81 },
            { value: 90, label: '-90 kg', max: 90 },
            { value: 91, label: '+90 kg', max: null, min: 90 }
        ],
        women: [
            { value: 40, label: '-40 kg', max: 40 },
            { value: 44, label: '-44 kg', max: 44 },
            { value: 48, label: '-48 kg', max: 48 },
            { value: 52, label: '-52 kg', max: 52 },
            { value: 57, label: '-57 kg', max: 57 },
            { value: 63, label: '-63 kg', max: 63 },
            { value: 70, label: '-70 kg', max: 70 },
            { value: 71, label: '+70 kg', max: null, min: 70 }
        ]
    },
    SUB_JUNIOR: {
        name: 'Sub Junior',
        ageRange: '12-15',
        minAge: 12,
        maxAge: 15,
        boy: [
            { value: 30, label: '-30 kg', max: 30 },
            { value: 35, label: '-35 kg', max: 35 },
            { value: 40, label: '-40 kg', max: 40 },
            { value: 45, label: '-45 kg', max: 45 },
            { value: 50, label: '-50 kg', max: 50 },
            { value: 55, label: '-55 kg', max: 55 },
            { value: 60, label: '-60 kg', max: 60 },
            { value: 66, label: '-66 kg', max: 66 },
            { value: 67, label: '+66 kg', max: null, min: 66 }
        ],
        girl: [
            { value: 28, label: '-28 kg', max: 28 },
            { value: 32, label: '-32 kg', max: 32 },
            { value: 36, label: '-36 kg', max: 36 },
            { value: 40, label: '-40 kg', max: 40 },
            { value: 44, label: '-44 kg', max: 44 },
            { value: 48, label: '-48 kg', max: 48 },
            { value: 52, label: '-52 kg', max: 52 },
            { value: 57, label: '-57 kg', max: 57 },
            { value: 58, label: '+57 kg', max: null, min: 57 }
        ]
    }
};

/**
 * Get all weight categories for a specific age group and gender
 */
function getWeightCategories(ageGroup, gender) {
    const group = WEIGHT_CATEGORIES[ageGroup];
    if (!group) return [];
    
    // Normalize gender for sub-junior (boy/girl)
    let genderKey = gender.toLowerCase();
    if (ageGroup === 'SUB_JUNIOR') {
        genderKey = gender.toLowerCase() === 'male' ? 'boy' : 'girl';
    } else {
        genderKey = gender.toLowerCase() === 'male' ? 'men' : 'women';
    }
    
    return group[genderKey] || [];
}

/**
 * Get all age groups
 */
function getAgeGroups() {
    return Object.keys(WEIGHT_CATEGORIES).map(key => ({
        key: key,
        name: WEIGHT_CATEGORIES[key].name,
        ageRange: WEIGHT_CATEGORIES[key].ageRange
    }));
}

/**
 * Determine weight category for a player based on weight and age
 */
function determineWeightCategory(weight, age, gender) {
    // Determine age group
    let ageGroup = 'SENIOR';
    if (age >= 12 && age < 15) {
        ageGroup = 'SUB_JUNIOR';
    } else if (age < 18) {
        ageGroup = 'CADET';
    } else if (age < 21) {
        ageGroup = 'JUNIOR';
    }
    
    const categories = getWeightCategories(ageGroup, gender);
    
    // Find matching category
    for (const category of categories) {
        if (category.max && weight <= category.max) {
            return {
                ageGroup: ageGroup,
                category: category,
                label: `${WEIGHT_CATEGORIES[ageGroup].name} ${category.label}`
            };
        } else if (!category.max && category.min && weight > category.min) {
            return {
                ageGroup: ageGroup,
                category: category,
                label: `${WEIGHT_CATEGORIES[ageGroup].name} ${category.label}`
            };
        }
    }
    
    return null;
}

/**
 * Populate weight filter dropdown
 */
function populateWeightFilter(filterId, ageGroup = null, gender = null) {
    const filterElement = document.getElementById(filterId);
    if (!filterElement) return;
    
    // Clear existing options except first
    filterElement.innerHTML = '<option value="">All Weights</option>';
    
    if (ageGroup && gender) {
        // Show specific age group and gender categories
        const categories = getWeightCategories(ageGroup, gender);
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.value;
            option.textContent = cat.label;
            filterElement.appendChild(option);
        });
    } else {
        // Show all unique weights from all categories
        const allWeights = new Set();
        Object.keys(WEIGHT_CATEGORIES).forEach(groupKey => {
            const group = WEIGHT_CATEGORIES[groupKey];
            ['men', 'women', 'boy', 'girl'].forEach(genderKey => {
                if (group[genderKey]) {
                    group[genderKey].forEach(cat => allWeights.add(cat.value));
                }
            });
        });
        
        Array.from(allWeights).sort((a, b) => a - b).forEach(weight => {
            const option = document.createElement('option');
            option.value = weight;
            option.textContent = `${weight} kg`;
            filterElement.appendChild(option);
        });
    }
}

// Make functions available globally
window.WEIGHT_CATEGORIES = WEIGHT_CATEGORIES;
window.getWeightCategories = getWeightCategories;
window.getAgeGroups = getAgeGroups;
window.determineWeightCategory = determineWeightCategory;
window.populateWeightFilter = populateWeightFilter;
