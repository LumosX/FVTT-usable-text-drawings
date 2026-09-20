// Core renders the text of a drawing as a single-line input. That shows a text of several lines as one, and saves it as one too.
export function makeTextFieldMultiline(sheet, element) {
    const input = element.querySelector('input[name="text"]');

    if (!input)
        return;

    // The input has dropped the line breaks from its value, but not from the attribute it was rendered with.
    const textarea = sheet.document.schema.fields.text.toInput({
        elementType: "textarea",
        value: input.getAttribute("value"),
        id: input.id,
        disabled: input.disabled,
        rows: 3
    });

    input.replaceWith(textarea);
}
