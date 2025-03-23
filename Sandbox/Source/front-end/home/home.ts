import { vec3, Vec3 } from 'wgpu-matrix';

class Light
{
    public strength: Vec3;
}


function OnSceneItemClick(objectName: string): void 
{
    console.log(`Clicked: ${objectName}`);

    let light: Light = new Light();
    light.strength = vec3.create(1, 2, 3);
    console.log(`Light   : ${light}`);
    console.log(`Strength: ${light.strength}`);
}

function ThrowIfNotDiv(elem: Element | null, errorMessage: string): HTMLDivElement {
    if (elem === null)
    {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLDivElement))
    {
        throw Error(errorMessage);
    }
    return elem;
}
function ThrowIfNotParagraph(elem: Element | null, errorMessage: string): HTMLParagraphElement {
    if (elem === null)
    {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLParagraphElement))
    {
        throw Error(errorMessage);
    }
    return elem;
}

// ===========================================================================================================
// Expandable Functionality
//   * Add a callback for every expandable element so that it can respond to opening and closing by clicking
// ===========================================================================================================
let titleBars = document.getElementsByClassName("expandable_title-bar")
for (let iii = 0; iii < titleBars.length; ++iii)
{
    let titleBar = ThrowIfNotDiv(titleBars[iii], `Invalid use of class '.expandable_title-bar' - it is meant to be on a div element`);
    titleBar.addEventListener("click", (ev: MouseEvent) => {

        // For this list item, we need to do 2 things: 1) toggle the open/close state on the whole
        // item to hide/reveal the content and 2) if the item is now open, then set we make the
        // title bar 'selected'
        let clickedListItem = ThrowIfNotDiv(titleBar.closest(".expandable_list-item"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list-item")' did not return a valid div`);
        if (clickedListItem.classList.toggle("expandable_is-open"))
        {
            titleBar.classList.add("scene-item-title-bar-selected");

            // Now, go through all items in the list to unselect all other items
            let expandableList = ThrowIfNotDiv(titleBar.closest(".expandable_list"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list")' did not return a valid div`);
            for (let iii = 0; iii < expandableList.children.length; ++iii)
            {
                let listItem = ThrowIfNotDiv(expandableList.children[iii], `Invalid structuring of 'expandable_list' - all of the children must be div elements`);
                
                // Skip the item that was clicked
                if (listItem === clickedListItem)
                    continue;

                // Make sure the item is unselected
                let listItemTitleBar = ThrowIfNotDiv(listItem.children[0], `Invalid structuring of 'expandable_list' - each item must have a first child that is a div representing the title bar`);
                listItemTitleBar.classList.remove("scene-item-title-bar-selected");
            } 

            // Now trigger OnSceneItemClick for this item
            let title = ThrowIfNotParagraph(titleBar.querySelector('.scene-item-title'), "Invalid structuring of 'scene-item-title-bar' - expected to have a child with class 'scene-item-title'");
            if (title.textContent !== null)
                OnSceneItemClick(title.textContent);
        }
    });
}
