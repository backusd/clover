//var coll = document.getElementsByClassName("scene-item");
//var i;
//
//for (i = 0; i < coll.length; i++) {
//    coll[i].addEventListener("click", function() {
//        this.classList.toggle("active");
//        var content = this.nextElementSibling;
//        if (content.style.maxHeight){
//            content.style.maxHeight = null;
//        } else {
//            content.style.maxHeight = content.scrollHeight + "px";
//        } 
//   });
//}

document.body.addEventListener("click", (ev) => {
    const isExpandableTitle = !!ev.target.closest(".expandable_title-bar");
    const expandable = ev.target.closest(".expandable");
    const titleBar = ev.target.closest(".expandable_title-bar");

    if (!isExpandableTitle) {
        return;
    }

    expandable.classList.toggle("expandable_open");
    titleBar.classList.toggle("expandable_title-bar-open");
});