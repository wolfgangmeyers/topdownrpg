import { Renderer } from '../../renderer';

export interface ButtonStyle {
    bgColor?: string;
    textColor?: string;
    borderColor?: string;
    font?: string;
    hoverBgColor?: string;
    hoverTextColor?: string;
    hoverBorderColor?: string;
    disabledBgColor?: string;
    disabledTextColor?: string;
    disabledBorderColor?: string;
    borderWidth?: number;
}

// Define some default styles
const defaultNormalStyle: Required<ButtonStyle> = {
    bgColor: 'rgba(70, 70, 200, 0.4)',
    textColor: 'white',
    borderColor: 'rgba(100, 100, 200, 0.6)',
    font: '14px Arial',
    hoverBgColor: 'rgba(90, 90, 220, 0.6)',
    hoverTextColor: 'white',
    hoverBorderColor: 'rgba(120, 120, 240, 0.8)',
    disabledBgColor: 'rgba(100, 100, 100, 0.6)',
    disabledTextColor: 'darkgray',
    disabledBorderColor: 'rgba(120, 120, 120, 0.7)',
    borderWidth: 2,
};

/**
 * Draws a reusable button component.
 * 
 * @param renderer The renderer instance.
 * @param x Button's top-left x coordinate.
 * @param y Button's top-left y coordinate.
 * @param width Button width.
 * @param height Button height.
 * @param text Text to display on the button.
 * @param isHovering True if the mouse is hovering over the button.
 * @param isDisabled True if the button should be drawn in a disabled state.
 * @param customStyle Optional custom styles to override defaults.
 */
export function drawButton(
    renderer: Renderer,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    isHovering: boolean = false,
    isDisabled: boolean = false,
    customStyle: ButtonStyle = {}
): void {
    const ctx = renderer.getContext();
    const style = { ...defaultNormalStyle, ...customStyle }; // Merge defaults with custom styles

    let currentBgColor = style.bgColor;
    let currentTextColor = style.textColor;
    let currentBorderColor = style.borderColor;

    if (isDisabled) {
        currentBgColor = style.disabledBgColor;
        currentTextColor = style.disabledTextColor;
        currentBorderColor = style.disabledBorderColor;
    } else if (isHovering) {
        currentBgColor = style.hoverBgColor;
        currentTextColor = style.hoverTextColor;
        currentBorderColor = style.hoverBorderColor;
    }

    ctx.save();

    // Draw background
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(x, y, width, height);

    // Draw border
    ctx.strokeStyle = currentBorderColor;
    ctx.lineWidth = style.borderWidth;
    ctx.strokeRect(x, y, width, height);

    // Draw text (centered)
    ctx.fillStyle = currentTextColor;
    ctx.font = style.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2); 

    ctx.restore();
} 