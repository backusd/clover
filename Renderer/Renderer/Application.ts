import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
import { Renderer } from "./Renderer.js";


export class Application
{
	constructor(renderer: Renderer, canvas: HTMLCanvasElement)
	{
		this.m_renderer = renderer;
		LOG_INFO("Application constructor");
	}
	private SetupInputCallbacks(): void
	{

	}

	public async InitializeAsync(): Promise<void>
	{
		LOG_INFO("Application InitializeAsync");

	}

	public Update(): void
	{

	}
	public Render(): void
	{

	}

	private m_renderer: Renderer;
}