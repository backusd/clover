#pragma once

#include <memory>
#include "Application.hpp"

extern Clover::Application* Clover::CreateApplication();

int main(int , char** )
{
	std::unique_ptr<Clover::Application> app(Clover::CreateApplication());
	app->Run();
	return 0;
}